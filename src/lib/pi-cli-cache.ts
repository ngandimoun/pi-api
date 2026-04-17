import { createHash } from "node:crypto";

/**
 * L3 validation result cache (Upstash Redis REST or in-process fallback).
 */

type CacheEntry = { value: unknown; exp: number };
const memoryL3 = new Map<string, CacheEntry>();
const MEM_TTL_MS = 300_000;
const MEM_MAX = 500;

function pruneMemoryCache(): void {
  const now = Date.now();
  for (const [k, v] of memoryL3) {
    if (v.exp <= now) memoryL3.delete(k);
  }
  if (memoryL3.size <= MEM_MAX) return;
  const keys = [...memoryL3.keys()].slice(0, memoryL3.size - MEM_MAX);
  for (const k of keys) memoryL3.delete(k);
}

function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.PI_CLI_UPSTASH_REDIS_REST_URL?.trim() || process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.PI_CLI_UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function upstashGet(key: string): Promise<string | null> {
  const cfg = getUpstashConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | null };
  return data.result ?? null;
}

async function upstashSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const cfg = getUpstashConfig();
  if (!cfg) return;
  const q = ttlSeconds > 0 ? `?ex=${ttlSeconds}` : "";
  await fetch(`${cfg.url}/set/${encodeURIComponent(key)}${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: value,
  });
}

export function buildPiCliValidationCacheKey(parts: {
  organizationId: string;
  intent?: string;
  routineHash: string;
  excerptsHash: string;
  localHash: string;
}): string {
  const raw = [
    parts.organizationId,
    parts.intent ?? "",
    parts.routineHash,
    parts.excerptsHash,
    parts.localHash,
  ].join("|");
  return `pi_cli_val:${createHash("sha256").update(raw).digest("hex")}`;
}

export async function getPiCliValidationCache(key: string): Promise<unknown | null> {
  const remote = await upstashGet(key);
  if (remote) {
    try {
      return JSON.parse(remote) as unknown;
    } catch {
      return null;
    }
  }
  pruneMemoryCache();
  const hit = memoryL3.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  if (hit) memoryL3.delete(key);
  return null;
}

export async function setPiCliValidationCache(key: string, value: unknown, ttlSeconds = 600): Promise<void> {
  const serialized = JSON.stringify(value);
  const cfg = getUpstashConfig();
  if (cfg) {
    await upstashSet(key, serialized, ttlSeconds);
    return;
  }
  pruneMemoryCache();
  memoryL3.set(key, { value, exp: Date.now() + MEM_TTL_MS });
}
