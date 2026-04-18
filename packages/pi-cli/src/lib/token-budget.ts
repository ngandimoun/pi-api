import fs from "node:fs/promises";
import path from "node:path";

import { PI_DIR } from "./constants.js";

const BUDGET_FILE = ".budget.json";

export type CommandKind = "validate" | "resonate" | "routine" | "prompt";

export type BudgetRecord = {
  /** Hour bucket as YYYY-MM-DDTHH (UTC) */
  hour: string;
  validate_calls: number;
  resonate_calls: number;
  routine_calls: number;
  prompt_calls: number;
  last_warned_validate?: number;
  last_warned_resonate?: number;
  last_warned_routine?: number;
  last_warned_prompt?: number;
};

function hourKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
}

async function loadBudget(cwd: string): Promise<BudgetRecord> {
  const p = path.join(cwd, PI_DIR, BUDGET_FILE);
  try {
    const raw = await fs.readFile(p, "utf8");
    const j = JSON.parse(raw) as BudgetRecord;
    if (j.hour === hourKey()) return j;
  } catch {
    /* new */
  }
  return { 
    hour: hourKey(), 
    validate_calls: 0,
    resonate_calls: 0,
    routine_calls: 0,
    prompt_calls: 0,
  };
}

async function saveBudget(cwd: string, rec: BudgetRecord): Promise<void> {
  const dir = path.join(cwd, PI_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, BUDGET_FILE), JSON.stringify(rec, null, 2), "utf8");
}

const DEFAULT_CAPS: Record<CommandKind, { soft: number; hard: number }> = {
  validate: { soft: 100, hard: 500 },
  resonate: { soft: 20, hard: 100 },
  routine: { soft: 15, hard: 75 },
  prompt: { soft: 50, hard: 250 },
};

function getCommandCaps(kind: CommandKind): { soft: number; hard: number } {
  const envPrefix = `PI_CLI_MAX_${kind.toUpperCase()}_PER_HOUR`;
  const softEnv = process.env[envPrefix];
  const hardEnv = process.env[`${envPrefix}_HARD`];
  
  return {
    soft: softEnv ? Number(softEnv) || DEFAULT_CAPS[kind].soft : DEFAULT_CAPS[kind].soft,
    hard: hardEnv ? Number(hardEnv) || DEFAULT_CAPS[kind].hard : DEFAULT_CAPS[kind].hard,
  };
}

/**
 * Record a Pi CLI API call; warn or block when over budget. Returns { ok, warn }.
 */
export async function recordPiApiCall(cwd: string, kind: CommandKind): Promise<{
  ok: boolean;
  warn?: string;
  callsThisHour: number;
}> {
  const caps = getCommandCaps(kind);

  let rec = await loadBudget(cwd);
  if (rec.hour !== hourKey()) {
    rec = { 
      hour: hourKey(), 
      validate_calls: 0,
      resonate_calls: 0,
      routine_calls: 0,
      prompt_calls: 0,
    };
  }
  
  const callField: keyof Pick<
    BudgetRecord,
    "validate_calls" | "resonate_calls" | "routine_calls" | "prompt_calls"
  > = `${kind}_calls`;
  rec[callField] = rec[callField] + 1;
  await saveBudget(cwd, rec);

  const callsThisHour = rec[callField];
  if (callsThisHour > caps.hard) {
    return {
      ok: false,
      warn: `Hard API budget exceeded (${callsThisHour}/${caps.hard} ${kind} calls this hour). Set PI_CLI_MAX_${kind.toUpperCase()}_PER_HOUR_HARD or reduce usage.`,
      callsThisHour,
    };
  }
  if (callsThisHour > caps.soft) {
    return {
      ok: true,
      warn: `${kind} API budget high (${callsThisHour}/${caps.soft} this hour). Consider reducing frequency or raising PI_CLI_MAX_${kind.toUpperCase()}_PER_HOUR.`,
      callsThisHour,
    };
  }
  return { ok: true, callsThisHour };
}

/**
 * @deprecated Use recordPiApiCall(cwd, "validate") instead. Kept for backward compatibility.
 */
export async function recordValidateApiCall(cwd: string): Promise<{
  ok: boolean;
  warn?: string;
  callsThisHour: number;
}> {
  return recordPiApiCall(cwd, "validate");
}

export async function getBudgetStats(cwd: string): Promise<BudgetRecord> {
  return loadBudget(cwd);
}
