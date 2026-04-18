import fs from "node:fs/promises";
import path from "node:path";

import { PiApiClient, type PiCliHealthReport } from "./api-client.js";
import { PI_DIR } from "./constants.js";

const HEALTH_CACHE_FILE = ".health.json";
const DEFAULT_TTL_MS = 60_000; // 60 seconds

type CachedHealth = {
  report: PiCliHealthReport;
  cached_at: number;
};

async function readHealthCache(cwd: string): Promise<CachedHealth | null> {
  try {
    const p = path.join(cwd, PI_DIR, HEALTH_CACHE_FILE);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as CachedHealth;
  } catch {
    return null;
  }
}

async function writeHealthCache(cwd: string, report: PiCliHealthReport): Promise<void> {
  const dir = path.join(cwd, PI_DIR);
  await fs.mkdir(dir, { recursive: true });
  const cached: CachedHealth = {
    report,
    cached_at: Date.now(),
  };
  await fs.writeFile(
    path.join(dir, HEALTH_CACHE_FILE),
    JSON.stringify(cached, null, 2),
    "utf8"
  );
}

/**
 * Probe Mastra availability once per session, cached for ttlMs.
 * Returns ok=false when the server is unreachable or unhealthy.
 */
export async function probeMastra(
  cwd: string,
  opts?: { ttlMs?: number }
): Promise<{ ok: boolean; report?: PiCliHealthReport; reason?: string }> {
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;

  // Check cache first
  const cached = await readHealthCache(cwd);
  if (cached && Date.now() - cached.cached_at < ttl) {
    return {
      ok: cached.report.ok,
      report: cached.report,
      reason: cached.report.ok ? undefined : "Mastra unhealthy (cached)",
    };
  }

  // Fresh probe
  try {
    const client = new PiApiClient();
    const report = await client.health();
    if (report) {
      await writeHealthCache(cwd, report);
    }

    return {
      ok: Boolean(report?.ok),
      report: report ?? undefined,
      reason: report?.ok ? undefined : "Mastra unhealthy",
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Network error";
    return {
      ok: false,
      reason: `Mastra offline: ${reason}`,
    };
  }
}

/**
 * Check if a command requires Mastra to be online.
 */
export function requiresMastra(command: string): boolean {
  const offlineOk = new Set(["init", "learn", "sync", "validate", "doctor", "watch"]);
  return !offlineOk.has(command);
}
