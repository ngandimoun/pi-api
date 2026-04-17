import fs from "node:fs/promises";
import path from "node:path";

import { PI_DIR } from "./constants.js";

const BUDGET_FILE = ".budget.json";

export type BudgetRecord = {
  /** Hour bucket as YYYY-MM-DDTHH (UTC) */
  hour: string;
  validate_calls: number;
  last_warned_validate?: number;
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
  return { hour: hourKey(), validate_calls: 0 };
}

async function saveBudget(cwd: string, rec: BudgetRecord): Promise<void> {
  const dir = path.join(cwd, PI_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, BUDGET_FILE), JSON.stringify(rec, null, 2), "utf8");
}

/** Record a cloud validate API call; warn or block when over budget. Returns { ok, warn }. */
export async function recordValidateApiCall(cwd: string): Promise<{
  ok: boolean;
  warn?: string;
  callsThisHour: number;
}> {
  const max = Number(process.env.PI_CLI_MAX_API_CALLS_PER_HOUR ?? 100) || 100;
  const hard = Number(process.env.PI_CLI_MAX_API_CALLS_PER_HOUR_HARD ?? 500) || 500;

  let rec = await loadBudget(cwd);
  if (rec.hour !== hourKey()) {
    rec = { hour: hourKey(), validate_calls: 0 };
  }
  rec.validate_calls += 1;
  await saveBudget(cwd, rec);

  const callsThisHour = rec.validate_calls;
  if (callsThisHour > hard) {
    return {
      ok: false,
      warn: `Hard API budget exceeded (${callsThisHour}/${hard} validate calls this hour). Set PI_CLI_MAX_API_CALLS_PER_HOUR_HARD or use --no-cache / reduce checks.`,
      callsThisHour,
    };
  }
  if (callsThisHour > max) {
    return {
      ok: true,
      warn: `Validate API budget high (${callsThisHour}/${max} this hour). Consider Rasengan cache hits or PI_CLI_VALIDATE_CACHE_TTL_MS.`,
      callsThisHour,
    };
  }
  return { ok: true, callsThisHour };
}

export async function getBudgetStats(cwd: string): Promise<BudgetRecord> {
  return loadBudget(cwd);
}
