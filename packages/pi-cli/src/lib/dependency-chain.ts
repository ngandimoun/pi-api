import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";

import { PI_DIR, SYSTEM_STYLE_FILE } from "./constants.js";
import { getApiKey } from "./config.js";

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Global CLI flags affecting implicit dependency chaining */
export type PreFlightGlobalOpts = {
  /** Skip all auto-triggers (power users) */
  noAuto?: boolean;
  /** Skip `pi learn` when system-style is missing */
  skipLearn?: boolean;
  /** Skip `pi sync` before validate */
  skipSync?: boolean;
  /** Strict mode: fail if learn hasn't run instead of auto-running (for CI) */
  requireLearn?: boolean;
};

export async function ensurePiDir(cwd: string, opts?: PreFlightGlobalOpts): Promise<void> {
  if (opts?.noAuto) return;
  const pi = path.join(cwd, PI_DIR);
  if (await pathExists(pi)) return;
  console.log(chalk.dim("◐ .pi/ missing — running `pi init`…"));
  const { runInit } = await import("../commands/init.js");
  await runInit(cwd);
}

/**
 * True when we should try pulling team artifacts before local learn/validate.
 * Requires API key. Opt-in via PI_CLI_AUTO_SYNC=true or when system-style is absent.
 */
export async function shouldSyncBeforeValidate(cwd: string, opts?: PreFlightGlobalOpts): Promise<boolean> {
  if (opts?.noAuto || opts?.skipSync) return false;
  if (!getApiKey()) return false;
  if (process.env.PI_CLI_AUTO_SYNC?.trim() === "true") return true;
  return !(await pathExists(path.join(cwd, SYSTEM_STYLE_FILE)));
}

export async function ensureTeamSyncIfNeeded(cwd: string, opts?: PreFlightGlobalOpts): Promise<void> {
  const should = await shouldSyncBeforeValidate(cwd, opts);
  if (!should) return;
  console.log(chalk.dim("◐ Pulling team artifacts — running `pi sync`…"));
  try {
    const { runSync } = await import("../commands/sync.js");
    await runSync(cwd, { includeGraph: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(chalk.yellow(`⚠ Could not auto-run \`pi sync\` (${msg}). Continuing…`));
  }
}

/**
 * Check if system-style.json needs learning (missing, empty, or stub).
 */
export async function needsLearnCheck(cwd: string): Promise<{
  needsLearn: boolean;
  reason?: string;
}> {
  const abs = path.join(cwd, SYSTEM_STYLE_FILE);
  if (!(await pathExists(abs))) {
    return { needsLearn: true, reason: "system-style.json not found" };
  }
  try {
    const raw = await fs.readFile(abs, "utf8");
    const j = JSON.parse(raw) as Record<string, unknown>;
    const stubNote =
      typeof j.note === "string" && j.note.includes("Run `pi learn`");
    if (Object.keys(j).length === 0) {
      return { needsLearn: true, reason: "system-style.json is empty" };
    }
    if (stubNote) {
      return { needsLearn: true, reason: "system-style.json is a stub (run pi learn)" };
    }
    return { needsLearn: false };
  } catch {
    return { needsLearn: true, reason: "system-style.json is invalid" };
  }
}

/** Populate `.pi/system-style.json` via `pi learn` when missing or empty stub. */
export async function ensureSystemStyleJson(cwd: string, opts?: PreFlightGlobalOpts): Promise<void> {
  if (opts?.noAuto || opts?.skipLearn) return;

  const { needsLearn, reason } = await needsLearnCheck(cwd);
  if (!needsLearn) return;

  if (opts?.requireLearn) {
    console.error(
      chalk.red(`\n✗ Pi hasn't learned your codebase: ${reason}\n`) +
        chalk.white("  Run ") +
        chalk.cyan("pi learn") +
        chalk.white(" first, or remove ") +
        chalk.yellow("--require-learn") +
        chalk.white(" to auto-learn.\n")
    );
    throw new Error(`Learn required: ${reason}`);
  }

  console.log(chalk.dim("◐ No system rules — running `pi learn`…"));
  try {
    const { runLearn } = await import("../commands/learn.js");
    await runLearn(cwd, undefined, { withGraph: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(
      chalk.yellow(`⚠ Could not auto-run \`pi learn\` (${msg}). Run \`pi learn\` when API access is available.`)
    );
  }
}

/** Pre-flight for `pi validate` / `pi check`: init → sync (if applicable) → learn */
export async function ensureValidatePreflight(cwd: string, opts?: PreFlightGlobalOpts): Promise<void> {
  await ensurePiDir(cwd, opts);
  await ensureTeamSyncIfNeeded(cwd, opts);
  await ensureSystemStyleJson(cwd, opts);
}

export type PiCommandPreflightKey =
  | "validate"
  | "check"
  | "fix"
  | "prompt"
  | "routine"
  | "resonate"
  | "watch"
  | "trace";

/**
 * Run implicit dependency hydration before a command body.
 * Does not replace explicit `pi auth-login` for missing keys.
 */
export async function runWithPreflight(
  cwd: string,
  key: PiCommandPreflightKey,
  opts: PreFlightGlobalOpts | undefined,
  runner: () => Promise<void>
): Promise<void> {
  if (opts?.noAuto) {
    await runner();
    return;
  }
  switch (key) {
    case "validate":
    case "check":
      await ensureValidatePreflight(cwd, opts);
      break;
    case "fix":
      await ensurePiDir(cwd, opts);
      break;
    case "prompt":
    case "routine":
      await ensurePiDir(cwd, opts);
      await ensureTeamSyncIfNeeded(cwd, opts);
      await ensureSystemStyleJson(cwd, opts);
      break;
    case "resonate":
      await ensurePiDir(cwd, opts);
      await ensureTeamSyncIfNeeded(cwd, opts);
      await ensureSystemStyleJson(cwd, opts);
      break;
    case "watch":
      await ensurePiDir(cwd, opts);
      break;
    case "trace":
      break;
    default:
      break;
  }
  await runner();
}
