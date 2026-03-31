import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { getServiceSupabaseClient } from "../lib/supabase";

const payloadSchema = z.object({
  dryRun: z.boolean().optional(),
  batchSize: z.number().int().min(100).max(50000).optional(),
});

function envBatchSize(): number {
  const parsed = Number(process.env.PI_ADS_CACHE_CLEANUP_BATCH_SIZE ?? "5000");
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 50000) : 5000;
}

/**
 * Periodic cleanup for persistent cache rows.
 * Schedule this task in Trigger.dev (e.g., every 15-60 minutes) to prevent unbounded growth.
 */
export const adsCacheCleanup = task({
  id: "ads-cache-cleanup",
  retry: { maxAttempts: 5 },
  run: async (payload) => {
    const parsed = payloadSchema.safeParse(payload ?? {});
    const dryRun = parsed.success ? parsed.data.dryRun === true : false;
    const batchSize = parsed.success ? parsed.data.batchSize ?? envBatchSize() : envBatchSize();

    const supabase = getServiceSupabaseClient();

    // Count expired rows (best-effort, may be slower but useful for reporting).
    const nowIso = new Date().toISOString();
    const { count } = await supabase
      .from("ads_artifact_cache")
      .select("key", { count: "exact", head: true })
      .lt("expires_at", nowIso);

    if (dryRun) {
      return { dryRun: true as const, expiredCount: count ?? 0, deleted: 0 };
    }

    // Delete in batches to avoid long transactions.
    let deletedTotal = 0;
    while (deletedTotal < batchSize) {
      const { data: keys } = await supabase
        .from("ads_artifact_cache")
        .select("key")
        .lt("expires_at", nowIso)
        .limit(Math.min(1000, batchSize - deletedTotal));

      const keyList = (keys ?? []).map((row) => (row as any).key).filter(Boolean);
      if (keyList.length === 0) break;

      const { error } = await supabase.from("ads_artifact_cache").delete().in("key", keyList);
      if (error) {
        throw new Error(`ads_cache_cleanup_delete_failed: ${error.message}`);
      }

      deletedTotal += keyList.length;
    }

    return {
      dryRun: false as const,
      expiredCount: count ?? null,
      deleted: deletedTotal,
      batchSize,
    };
  },
});

