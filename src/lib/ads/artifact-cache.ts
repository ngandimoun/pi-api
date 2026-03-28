import crypto from "crypto";

import { getServiceSupabaseClient } from "@/lib/supabase";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  sizeBytes: number;
};

function nowMs(): number {
  return Date.now();
}

function ttlMs(): number {
  const parsed = Number(process.env.PI_ADS_CACHE_TTL_MS ?? "900000");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 900000;
}

function ttlJitterMs(): number {
  const parsed = Number(process.env.PI_ADS_CACHE_TTL_JITTER_MS ?? "30000");
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 30000;
}

function maxEntries(): number {
  const parsed = Number(process.env.PI_ADS_CACHE_MAX_ENTRIES ?? "2000");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 2000;
}

function maxBytes(): number {
  const parsed = Number(process.env.PI_ADS_CACHE_MAX_BYTES ?? String(32 * 1024 * 1024));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 32 * 1024 * 1024;
}

function maxEntryBytes(): number {
  const parsed = Number(process.env.PI_ADS_CACHE_MAX_ENTRY_BYTES ?? String(256 * 1024));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 256 * 1024;
}

function cacheBackend(): "memory" | "supabase" {
  const raw = (process.env.PI_ADS_CACHE_BACKEND ?? "memory").trim().toLowerCase();
  return raw === "supabase" ? "supabase" : "memory";
}

function telemetryEnabled(): boolean {
  return (process.env.PI_ADS_CACHE_TELEMETRY ?? "true").trim().toLowerCase() === "true";
}

function telemetryFlushEveryMs(): number {
  const parsed = Number(process.env.PI_ADS_CACHE_TELEMETRY_FLUSH_MS ?? "60000");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60000;
}

type TelemetryCounters = { hit: number; miss: number; set: number };
const telemetryByStage = new Map<string, TelemetryCounters>();
let lastTelemetryFlushAt = 0;

function extractStage(key: string): string {
  const idx = key.indexOf(":");
  return idx > 0 ? key.slice(0, idx) : "unknown";
}

function bump(stage: string, field: keyof TelemetryCounters) {
  const existing = telemetryByStage.get(stage) ?? { hit: 0, miss: 0, set: 0 };
  existing[field] += 1;
  telemetryByStage.set(stage, existing);
}

function maybeFlushTelemetry() {
  if (!telemetryEnabled()) return;
  const now = nowMs();
  const interval = telemetryFlushEveryMs();
  if (now - lastTelemetryFlushAt < interval) return;
  lastTelemetryFlushAt = now;

  const snapshot = Array.from(telemetryByStage.entries())
    .map(([stage, c]) => ({ stage, ...c }))
    .sort((a, b) => (b.hit + b.miss) - (a.hit + a.miss))
    .slice(0, 30);

  console.info("[ads.cache] telemetry", {
    backend: cacheBackend(),
    total_bytes: totalBytes,
    entry_count: cache.size,
    top: snapshot,
  });
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

function digest(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function estimateSizeBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 1024 * 1024;
  }
}

function jitteredTtl(): number {
  const jitter = ttlJitterMs();
  if (jitter <= 0) return ttlMs();
  const delta = Math.floor(Math.random() * (jitter + 1));
  return Math.max(1000, ttlMs() - delta);
}

// LRU map: most-recent at end. We move key to end on get/set.
const cache = new Map<string, CacheEntry<unknown>>();
let totalBytes = 0;

function evictExpired() {
  const now = nowMs();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
      totalBytes -= entry.sizeBytes;
    }
  }
}

function evictToFit(neededBytes: number) {
  const byteLimit = maxBytes();
  const entryLimit = maxEntries();
  while (
    cache.size > 0 &&
    (cache.size + 1 > entryLimit || totalBytes + neededBytes > byteLimit)
  ) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const entry = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (entry) totalBytes -= entry.sizeBytes;
  }
}

function touch(key: string, entry: CacheEntry<unknown>) {
  cache.delete(key);
  cache.set(key, entry);
}

export function buildArtifactCacheKey(stage: string, payload: unknown): string {
  return `${stage}:${digest(payload)}`;
}

async function getMemory<T>(key: string): Promise<T | null> {
  const stage = extractStage(key);
  const hit = cache.get(key);
  if (!hit) {
    bump(stage, "miss");
    maybeFlushTelemetry();
    return null;
  }
  if (hit.expiresAt <= nowMs()) {
    cache.delete(key);
    totalBytes -= hit.sizeBytes;
    bump(stage, "miss");
    maybeFlushTelemetry();
    return null;
  }
  touch(key, hit);
  bump(stage, "hit");
  maybeFlushTelemetry();
  return hit.value as T;
}

async function setMemory<T>(key: string, value: T): Promise<void> {
  const stage = extractStage(key);
  evictExpired();
  const sizeBytes = estimateSizeBytes(value);
  if (sizeBytes > maxEntryBytes()) {
    return;
  }
  const expiresAt = nowMs() + jitteredTtl();
  const existing = cache.get(key);
  if (existing) {
    totalBytes -= existing.sizeBytes;
  }
  evictToFit(sizeBytes);
  const entry: CacheEntry<unknown> = { value, expiresAt, sizeBytes };
  cache.set(key, entry);
  totalBytes += sizeBytes;
  bump(stage, "set");
  maybeFlushTelemetry();
}

async function getSupabase<T>(key: string): Promise<T | null> {
  const stage = extractStage(key);
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("ads_artifact_cache")
    .select("value,expires_at")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) {
    bump(stage, "miss");
    maybeFlushTelemetry();
    return null;
  }
  const expiresAtMs = Date.parse(String((data as any).expires_at));
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs()) {
    await supabase.from("ads_artifact_cache").delete().eq("key", key);
    bump(stage, "miss");
    maybeFlushTelemetry();
    return null;
  }
  bump(stage, "hit");
  maybeFlushTelemetry();
  return (data as any).value as T;
}

async function setSupabase<T>(key: string, value: T): Promise<void> {
  const stage = extractStage(key);
  const sizeBytes = estimateSizeBytes(value);
  if (sizeBytes > maxEntryBytes()) return;
  const supabase = getServiceSupabaseClient();
  const expiresAt = new Date(nowMs() + jitteredTtl()).toISOString();
  await supabase.from("ads_artifact_cache").upsert(
    {
      key,
      value,
      size_bytes: sizeBytes,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  bump(stage, "set");
  maybeFlushTelemetry();
}

export async function getArtifactCache<T>(key: string): Promise<T | null> {
  return cacheBackend() === "supabase" ? getSupabase<T>(key) : getMemory<T>(key);
}

export async function setArtifactCache<T>(key: string, value: T): Promise<void> {
  if (cacheBackend() === "supabase") {
    // Best-effort: keep memory warm too, but don't block on it.
    await setSupabase(key, value);
    await setMemory(key, value);
    return;
  }
  await setMemory(key, value);
}

