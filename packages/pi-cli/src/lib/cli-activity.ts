import fs from "node:fs/promises";
import path from "node:path";

import { PI_CLI_ACTIVITY_FILE } from "./constants.js";

export type CliActivity = {
  last_validate_at?: string;
  last_validate_ok?: boolean;
  last_prompt_at?: string;
  seen_omni_router?: boolean;
};

async function readActivity(cwd: string): Promise<CliActivity> {
  try {
    const raw = await fs.readFile(path.join(cwd, PI_CLI_ACTIVITY_FILE), "utf8");
    return JSON.parse(raw) as CliActivity;
  } catch {
    return {};
  }
}

async function writeActivity(cwd: string, next: CliActivity): Promise<void> {
  await fs.mkdir(path.join(cwd, ".pi"), { recursive: true });
  await fs.writeFile(path.join(cwd, PI_CLI_ACTIVITY_FILE), JSON.stringify(next, null, 2) + "\n", "utf8");
}

export async function touchValidateActivity(cwd: string, ok: boolean): Promise<void> {
  const prev = await readActivity(cwd);
  await writeActivity(cwd, {
    ...prev,
    last_validate_at: new Date().toISOString(),
    last_validate_ok: ok,
  });
}

export async function touchPromptActivity(cwd: string): Promise<void> {
  const prev = await readActivity(cwd);
  await writeActivity(cwd, {
    ...prev,
    last_prompt_at: new Date().toISOString(),
  });
}

export async function readCliActivity(cwd: string): Promise<CliActivity> {
  return readActivity(cwd);
}

export async function hasSeenOmniRouter(cwd: string): Promise<boolean> {
  const activity = await readActivity(cwd);
  return Boolean(activity.seen_omni_router);
}

export async function markOmniRouterSeen(cwd: string): Promise<void> {
  const prev = await readActivity(cwd);
  await writeActivity(cwd, {
    ...prev,
    seen_omni_router: true,
  });
}

/** Days since ISO timestamp, or null if missing/invalid. */
export function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}
