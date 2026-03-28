import { describe, expect, it } from "vitest";

import { buildArtifactCacheKey, getArtifactCache, setArtifactCache } from "@/lib/ads/artifact-cache";

describe("ads artifact cache (memory backend)", () => {
  it("stores and retrieves cached values", async () => {
    process.env.PI_ADS_CACHE_BACKEND = "memory";
    process.env.PI_ADS_CACHE_TELEMETRY = "false";
    const key = buildArtifactCacheKey("stage", { a: 1 });
    await setArtifactCache(key, { ok: true });
    const value = await getArtifactCache<{ ok: boolean }>(key);
    expect(value?.ok).toBe(true);
  });

  it("skips caching overly large entries", async () => {
    process.env.PI_ADS_CACHE_BACKEND = "memory";
    process.env.PI_ADS_CACHE_TELEMETRY = "false";
    process.env.PI_ADS_CACHE_MAX_ENTRY_BYTES = "100";
    const key = buildArtifactCacheKey("stage", { b: 2 });
    await setArtifactCache(key, { big: "x".repeat(5000) });
    const value = await getArtifactCache(key);
    expect(value).toBeNull();
  });
});

