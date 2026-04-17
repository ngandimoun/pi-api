import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import chokidar from "chokidar";

import { createSharinganProject } from "../lib/ast/sharingan.js";
import { ensurePiDir, type PreFlightGlobalOpts } from "../lib/dependency-chain.js";
import { PI_WATCH_PID_FILE } from "../lib/constants.js";
import {
  appendWatchLog,
  clearWatchHealth,
  readWatchHealth,
  readWatchLock,
  releaseWatchLock,
  tryAcquireWatchLock,
  watchLogPath,
  writeWatchHealth,
  type WatchHealthRecord,
} from "../lib/watch-observability.js";
import { runDeterministicRulesWithContext } from "../lib/rules/deterministic.js";
import { buildDefaultRuleRuntimeContext, type RuleRuntimeContext } from "../lib/rules/rule-loader.js";
import { suggestRoutineIdsFromRepoContext } from "../lib/routine-context-detector.js";
import { getCurrentBranch, getPendingChanges } from "../lib/vcs/index.js";

const CHILD_ENV = "PI_CLI_WATCH_CHILD";
const WATCH_SEMVER = "0.1.0";

export type WatchCliOpts = PreFlightGlobalOpts & {
  daemon?: boolean;
  stop?: boolean;
  status?: boolean;
  /** With --daemon: run in this process (logs + heartbeat) instead of spawning. */
  foreground?: boolean;
  /** Log repo-scored routine id hints (throttled). */
  suggestRoutines?: boolean;
};

type PidRecord = { pid: number; cwd: string; startedAt: string };

function heartbeatMs(): number {
  const n = Number(process.env.PI_CLI_WATCH_HEARTBEAT_MS ?? 10_000);
  return Number.isFinite(n) && n >= 2000 ? n : 10_000;
}

function staleHeartbeatMs(): number {
  const n = Number(process.env.PI_CLI_WATCH_STALE_MS ?? 45_000);
  return Number.isFinite(n) && n >= 5000 ? n : 45_000;
}

function logMaxBytes(): number {
  const n = Number(process.env.PI_CLI_WATCH_LOG_MAX_BYTES ?? 1_500_000);
  return Number.isFinite(n) && n >= 100_000 ? n : 1_500_000;
}

async function readPidRecord(cwd: string): Promise<PidRecord | null> {
  try {
    const raw = await fs.readFile(path.join(cwd, PI_WATCH_PID_FILE), "utf8");
    const rec = JSON.parse(raw) as PidRecord;
    if (typeof rec.pid !== "number") return null;
    return rec;
  } catch {
    return null;
  }
}

async function writePidRecord(cwd: string, rec: PidRecord): Promise<void> {
  await fs.mkdir(path.join(cwd, ".pi"), { recursive: true });
  await fs.writeFile(path.join(cwd, PI_WATCH_PID_FILE), JSON.stringify(rec, null, 2) + "\n", "utf8");
}

async function clearPidRecord(cwd: string): Promise<void> {
  try {
    await fs.unlink(path.join(cwd, PI_WATCH_PID_FILE));
  } catch {
    /* none */
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function cleanupStaleWatchArtifacts(cwd: string): Promise<void> {
  const lock = await readWatchLock(cwd);
  if (lock && !isProcessAlive(lock.pid)) await releaseWatchLock(cwd);

  const health = await readWatchHealth(cwd);
  if (health && !isProcessAlive(health.pid)) {
    await clearWatchHealth(cwd);
    await clearPidRecord(cwd);
  }

  const pidRec = await readPidRecord(cwd);
  if (pidRec && !isProcessAlive(pidRec.pid)) await clearPidRecord(cwd);
}

export async function getWatchDaemonStatus(cwd: string): Promise<{
  running: boolean;
  healthy?: boolean;
  staleHeartbeat?: boolean;
  pid?: number;
  startedAt?: string;
  staleFile?: boolean;
  lastTick?: string;
  logPath?: string;
}> {
  const logPath = watchLogPath(cwd);
  const health = await readWatchHealth(cwd);
  const staleMs = staleHeartbeatMs();
  const now = Date.now();

  if (health) {
    const tick = Date.parse(health.lastTick);
    const tickOk = Number.isFinite(tick);
    const age = tickOk ? now - tick : Infinity;
    const pidAlive = isProcessAlive(health.pid);

    if (pidAlive && tickOk && age <= staleMs) {
      return {
        running: true,
        healthy: true,
        pid: health.pid,
        lastTick: health.lastTick,
        logPath,
      };
    }
    if (pidAlive && tickOk && age > staleMs) {
      return {
        running: true,
        healthy: false,
        staleHeartbeat: true,
        pid: health.pid,
        lastTick: health.lastTick,
        logPath,
      };
    }
    if (!pidAlive) {
      return { running: false, staleFile: true, pid: health.pid, lastTick: health.lastTick, logPath };
    }
  }

  const rec = await readPidRecord(cwd);
  if (!rec) return { running: false, logPath };
  if (!isProcessAlive(rec.pid)) {
    return { running: false, staleFile: true, pid: rec.pid, startedAt: rec.startedAt, logPath };
  }
  return { running: true, healthy: undefined, pid: rec.pid, startedAt: rec.startedAt, logPath };
}

async function clearDaemonState(cwd: string): Promise<void> {
  await clearPidRecord(cwd);
  await releaseWatchLock(cwd);
  await clearWatchHealth(cwd);
}

export async function stopWatchDaemon(cwd: string): Promise<{ ok: boolean; message: string }> {
  const rec = await readPidRecord(cwd);
  const health = await readWatchHealth(cwd);
  const pid = rec?.pid ?? health?.pid;
  if (!pid) {
    await clearDaemonState(cwd);
    return { ok: true, message: "No Pi watch process found (.pi/.watch-pid.json or .pi/.watch-health.json)." };
  }
  if (!isProcessAlive(pid)) {
    await clearDaemonState(cwd);
    return { ok: true, message: `Stale watch pid ${pid} removed.` };
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to signal watch process" };
  }
  await clearDaemonState(cwd);
  return { ok: true, message: `Sent SIGTERM to Pi watch (pid ${pid}).` };
}

export async function startWatchDaemon(cwd: string, opts?: WatchCliOpts): Promise<void> {
  await cleanupStaleWatchArtifacts(cwd);

  const st = await getWatchDaemonStatus(cwd);
  if (st.running && st.healthy !== false) {
    console.log(chalk.yellow(`Pi watch already running (pid ${st.pid}).`));
    console.log(chalk.dim(`Log: ${watchLogPath(cwd)}`));
    console.log(chalk.dim("Stop with: pi watch --stop"));
    return;
  }
  if (st.staleHeartbeat) {
    console.log(chalk.yellow("Pi watch heartbeat is stale; attempting restart…"));
    if (st.pid) {
      try {
        process.kill(st.pid, "SIGTERM");
      } catch {
        /* ignore */
      }
    }
    await clearDaemonState(cwd);
  }

  await ensurePiDir(cwd, opts);

  const exe = process.execPath;
  const script = process.argv[1] ?? "";
  const args = [script, "watch"];
  if (opts?.noAuto) args.push("--no-auto");
  if (opts?.suggestRoutines) args.push("--suggest-routines");

  const child = spawn(exe, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, [CHILD_ENV]: "1" },
  });
  child.unref();

  if (!child.pid) {
    console.error(chalk.red("Failed to spawn Pi watch daemon."));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.green(`✓ Pi watch running in background (pid ${child.pid})`));
  console.log(chalk.dim(`Log: ${watchLogPath(cwd)}`));
  console.log(chalk.dim("Status: pi watch --stop | pi watch --status"));
}

type WatchRuntimeOpts = {
  cwd: string;
  debounceMs: number;
  /** Plain-text log lines (no chalk) */
  log?: (line: string) => void | Promise<void>;
  onBeforeShutdown?: () => void | Promise<void>;
  suggestRoutines?: boolean;
};

async function runWatchLoop(opts: WatchRuntimeOpts): Promise<void> {
  const { cwd, debounceMs, log, suggestRoutines } = opts;
  const sharingan = createSharinganProject(cwd);
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  let ruleCtx: RuleRuntimeContext | undefined;
  let lastRoutineHintLog = 0;
  const ensureCtx = async () => {
    if (!ruleCtx) ruleCtx = await buildDefaultRuleRuntimeContext(cwd);
    return ruleCtx;
  };

  const lineOut = async (s: string, useChalk: boolean) => {
    if (useChalk) console.log(s);
    if (log) await log(useChalk ? s.replace(/\u001b\[[0-9;]*m/g, "") : s);
  };

  const flushOne = (absPath: string) => {
    const rel = path.relative(cwd, absPath);
    if (!/\.(tsx|ts|jsx|js)$/.test(absPath)) return;

    const t0 = Date.now();
    void (async () => {
      try {
        const ctx = await ensureCtx();
        const sf = sharingan.project.getSourceFile(absPath) ?? sharingan.project.addSourceFileAtPath(absPath);
        const violations = runDeterministicRulesWithContext(sf, ctx);
        const ms = Date.now() - t0;

        if (violations.length) {
          const worst = violations.some((v) => v.severity === "error") ? "error" : "warn";
          const icon = worst === "error" ? chalk.red("❌") : chalk.yellow("⚠️");
          await lineOut(`${icon} ${chalk.bold(rel)} (${ms}ms)`, true);
          for (const v of violations.slice(0, 8)) {
            const mark = v.severity === "error" ? chalk.red("error") : chalk.yellow("warn ");
            await lineOut(`  ${mark} ${v.rule}:L${v.line} — ${v.message}`, true);
          }
          if (violations.length > 8) {
            await lineOut(chalk.gray(`  … +${violations.length - 8} more`), true);
          }
          await lineOut(chalk.dim(`  tip: pi fix --staged   (or)   pi validate --staged --strict`), true);
        }
      } catch (e) {
        await lineOut(`watch error ${rel} ${e instanceof Error ? e.message : String(e)}`, true);
      }

      if (suggestRoutines && log) {
        const now = Date.now();
        if (now - lastRoutineHintLog >= 60_000) {
          lastRoutineHintLog = now;
          try {
            const branch = await getCurrentBranch(cwd);
            const changed = await getPendingChanges(cwd);
            const ids = await suggestRoutineIdsFromRepoContext(cwd, { branchName: branch, changedRelPaths: changed });
            if (ids.length) await log(`routine-hints: ${ids.join(", ")}`);
          } catch {
            /* ignore */
          }
        }
      }
    })();
  };

  const schedule = (absPath: string) => {
    const prev = pending.get(absPath);
    if (prev) clearTimeout(prev);
    const id = setTimeout(() => {
      pending.delete(absPath);
      flushOne(absPath);
    }, debounceMs);
    pending.set(absPath, id);
  };

  const watcher = chokidar.watch(
    ["**/*.{ts,tsx,js,jsx}"],
    {
      cwd,
      ignored: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/.git/**",
        `${path.join(".pi", "**").replace(/\\/g, "/")}`,
      ],
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
    }
  );

  watcher.on("change", (p) => schedule(path.resolve(cwd, p)));
  watcher.on("add", (p) => schedule(path.resolve(cwd, p)));

  await lineOut(
    chalk.cyan("Pi watch") + chalk.gray(` — deterministic governance on save (${debounceMs}ms debounce)`),
    true
  );
  await lineOut(chalk.gray("Press Ctrl+C to stop."), true);

  const shutdown = async () => {
    for (const t of pending.values()) clearTimeout(t);
    pending.clear();
    await watcher.close();
    await opts.onBeforeShutdown?.();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await new Promise<void>(() => {
    /* keep alive */
  });
}

async function runWatchDaemonChild(cwd: string, opts?: WatchCliOpts): Promise<void> {
  await ensurePiDir(cwd, opts);

  const acquired = await tryAcquireWatchLock(cwd, process.pid);
  if (!acquired) {
    const other = await readWatchLock(cwd);
    if (other && isProcessAlive(other.pid)) {
      await appendWatchLog(
        cwd,
        `[${new Date().toISOString()}] Another Pi watch holds the lock (pid ${other.pid}). Exiting.`,
        logMaxBytes()
      );
      console.error(
        chalk.red(`Pi watch already running (lock pid ${other.pid}).`),
        chalk.dim(`See ${watchLogPath(cwd)}`)
      );
      process.exit(1);
      return;
    }
    await releaseWatchLock(cwd);
    if (!(await tryAcquireWatchLock(cwd, process.pid))) {
      console.error(chalk.red("Could not acquire Pi watch lock."));
      process.exit(1);
      return;
    }
  }

  await writePidRecord(cwd, {
    pid: process.pid,
    cwd: path.resolve(cwd),
    startedAt: new Date().toISOString(),
  });

  const hbMs = heartbeatMs();
  let hb: ReturnType<typeof setInterval> | undefined;
  const tickHealth = async () => {
    const rec: WatchHealthRecord = {
      pid: process.pid,
      lastTick: new Date().toISOString(),
      cwd: path.resolve(cwd),
      version: WATCH_SEMVER,
    };
    await writeWatchHealth(cwd, rec);
  };
  await tickHealth();
  hb = setInterval(() => void tickHealth(), hbMs);

  const debounceMs = Number(process.env.PI_CLI_WATCH_DEBOUNCE_MS ?? 2000) || 2000;
  const maxLog = logMaxBytes();

  await appendWatchLog(cwd, `[${new Date().toISOString()}] Pi watch daemon started (pid ${process.pid})`, maxLog);

  const log = (line: string) => appendWatchLog(cwd, `[${new Date().toISOString()}] ${line}`, maxLog);

  const cleanup = async () => {
    if (hb) clearInterval(hb);
    await appendWatchLog(cwd, `[${new Date().toISOString()}] Pi watch daemon stopping`, maxLog);
    await clearDaemonState(cwd);
  };

  await runWatchLoop({
    cwd,
    debounceMs,
    log,
    onBeforeShutdown: cleanup,
    suggestRoutines: Boolean(opts?.suggestRoutines),
  });
}

async function runWatchForegroundObservable(cwd: string, opts?: WatchCliOpts): Promise<void> {
  await ensurePiDir(cwd, opts);
  const debounceMs = Number(process.env.PI_CLI_WATCH_DEBOUNCE_MS ?? 2000) || 2000;
  const maxLog = logMaxBytes();
  const log = (line: string) => appendWatchLog(cwd, `[${new Date().toISOString()}] ${line}`, maxLog);
  await appendWatchLog(cwd, `[${new Date().toISOString()}] Pi watch foreground (observable log)`, maxLog);

  const hbMs = heartbeatMs();
  let hb: ReturnType<typeof setInterval> | undefined;
  const tickHealth = async () => {
    await writeWatchHealth(cwd, {
      pid: process.pid,
      lastTick: new Date().toISOString(),
      cwd: path.resolve(cwd),
      version: WATCH_SEMVER,
    });
  };
  await tickHealth();
  hb = setInterval(() => void tickHealth(), hbMs);

  const cleanup = async () => {
    if (hb) clearInterval(hb);
    await clearWatchHealth(cwd);
    await appendWatchLog(cwd, `[${new Date().toISOString()}] Pi watch foreground stopped`, maxLog);
  };

  await runWatchLoop({
    cwd,
    debounceMs,
    log: async (line) => {
      await log(line);
    },
    onBeforeShutdown: cleanup,
    suggestRoutines: Boolean(opts?.suggestRoutines),
  });
}

async function runWatchForeground(cwd: string, opts?: WatchCliOpts): Promise<void> {
  await ensurePiDir(cwd, opts);
  const debounceMs = Number(process.env.PI_CLI_WATCH_DEBOUNCE_MS ?? 2000) || 2000;
  await runWatchLoop({ cwd, debounceMs, suggestRoutines: Boolean(opts?.suggestRoutines) });
}

export async function runWatch(cwd: string, opts?: WatchCliOpts): Promise<void> {
  if (process.env[CHILD_ENV] === "1") {
    delete process.env[CHILD_ENV];
    await runWatchDaemonChild(cwd, opts);
    return;
  }

  if (opts?.stop) {
    const r = await stopWatchDaemon(cwd);
    console.log(r.ok ? chalk.green(r.message) : chalk.red(r.message));
    if (!r.ok) process.exitCode = 1;
    return;
  }

  if (opts?.status) {
    const s = await getWatchDaemonStatus(cwd);
    if (s.running && s.healthy !== false) {
      console.log(chalk.green(`Pi watch daemon: running (pid ${s.pid})`));
      if (s.lastTick) console.log(chalk.dim(`Last heartbeat: ${s.lastTick}`));
      if (s.logPath) console.log(chalk.dim(`Log: ${s.logPath}`));
      console.log(chalk.dim("Windows: Get-Process -Id " + String(s.pid)));
    } else if (s.staleHeartbeat) {
      console.log(chalk.yellow(`Pi watch: process alive but heartbeat stale (pid ${s.pid}).`));
      console.log(chalk.dim(`Last tick: ${s.lastTick}`));
      console.log(chalk.dim(`Log: ${s.logPath ?? watchLogPath(cwd)}`));
      console.log(chalk.dim("Try: pi watch --stop && pi watch --daemon"));
    } else if (s.staleFile) {
      console.log(chalk.yellow(`Stale Pi watch metadata (pid ${s.pid ?? "?"}) — process not running.`));
      console.log(chalk.dim("Run: pi watch --stop"));
    } else {
      console.log(chalk.dim("Pi watch daemon: not running"));
      console.log(chalk.dim(`Foreground: pi watch   |   Background: pi watch --daemon`));
    }
    return;
  }

  if (opts?.daemon && opts?.foreground) {
    await runWatchDaemonChild(cwd, opts);
    return;
  }

  if (opts?.daemon) {
    await startWatchDaemon(cwd, opts);
    return;
  }

  if (opts?.foreground) {
    await runWatchForegroundObservable(cwd, opts);
    return;
  }

  await runWatchForeground(cwd, opts);
}
