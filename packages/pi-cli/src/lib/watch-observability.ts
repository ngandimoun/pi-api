import fs from "node:fs/promises";
import path from "node:path";

import {
  PI_WATCH_HEALTH_FILE,
  PI_WATCH_LOCK_FILE,
  PI_WATCH_LOG_FILE,
} from "./constants.js";

const ANSI = /\u001b\[[0-9;]*m/g;

export type WatchHealthRecord = {
  pid: number;
  lastTick: string;
  cwd: string;
  version: string;
};

export function stripAnsi(s: string): string {
  return s.replace(ANSI, "");
}

export function watchLogPath(cwd: string): string {
  return path.join(cwd, PI_WATCH_LOG_FILE);
}

export function watchHealthPath(cwd: string): string {
  return path.join(cwd, PI_WATCH_HEALTH_FILE);
}

export function watchLockPath(cwd: string): string {
  return path.join(cwd, PI_WATCH_LOCK_FILE);
}

export async function ensureWatchLogDir(cwd: string): Promise<void> {
  await fs.mkdir(path.join(cwd, ".pi", "logs"), { recursive: true });
}

/** Append one line (newline added). Rotates by truncating log if over maxBytes. */
export async function appendWatchLog(
  cwd: string,
  line: string,
  maxBytes: number
): Promise<void> {
  await ensureWatchLogDir(cwd);
  const logPath = watchLogPath(cwd);
  const plain = stripAnsi(line);
  const chunk = Buffer.byteLength(plain + "\n", "utf8");
  try {
    const st = await fs.stat(logPath);
    if (st.size + chunk > maxBytes) {
      await fs.unlink(logPath).catch(() => {
        /* none */
      });
    }
  } catch {
    /* no file yet */
  }
  await fs.appendFile(logPath, plain + "\n", "utf8");
}

export async function writeWatchHealth(cwd: string, rec: WatchHealthRecord): Promise<void> {
  await fs.mkdir(path.join(cwd, ".pi"), { recursive: true });
  await fs.writeFile(watchHealthPath(cwd), JSON.stringify(rec, null, 2) + "\n", "utf8");
}

export async function clearWatchHealth(cwd: string): Promise<void> {
  try {
    await fs.unlink(watchHealthPath(cwd));
  } catch {
    /* none */
  }
}

export type WatchLockRecord = { pid: number; since: string };

export async function tryAcquireWatchLock(cwd: string, pid: number): Promise<boolean> {
  await fs.mkdir(path.join(cwd, ".pi"), { recursive: true });
  const lockPath = watchLockPath(cwd);
  const body = JSON.stringify({ pid, since: new Date().toISOString() } satisfies WatchLockRecord, null, 2) + "\n";
  try {
    await fs.writeFile(lockPath, body, { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

export async function readWatchLock(cwd: string): Promise<WatchLockRecord | null> {
  try {
    const raw = await fs.readFile(watchLockPath(cwd), "utf8");
    return JSON.parse(raw) as WatchLockRecord;
  } catch {
    return null;
  }
}

export async function releaseWatchLock(cwd: string): Promise<void> {
  try {
    await fs.unlink(watchLockPath(cwd));
  } catch {
    /* none */
  }
}

export async function readWatchHealth(cwd: string): Promise<WatchHealthRecord | null> {
  try {
    const raw = await fs.readFile(watchHealthPath(cwd), "utf8");
    const rec = JSON.parse(raw) as WatchHealthRecord;
    if (typeof rec.pid !== "number" || typeof rec.lastTick !== "string") return null;
    return rec;
  } catch {
    return null;
  }
}
