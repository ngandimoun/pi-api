import { getServiceSupabaseClient } from "@/lib/supabase";
import { getUnkeyClient, ratelimitsForTier } from "@/lib/unkey";

/**
 * Enable/disable all non-revoked Unkey keys for a user and apply tier ratelimits when active.
 * Called from Stripe webhooks after subscription changes.
 */
export async function syncUnkeyKeysForUser(
  userId: string,
  opts: { subscriptionActive: boolean; tier: string }
): Promise<void> {
  const supabase = getServiceSupabaseClient();
  const { data: rows, error } = await supabase
    .from("api_keys")
    .select("unkey_key_id")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) {
    console.error("[unkey-user-sync] list keys failed", error);
    return;
  }

  if (!rows?.length) return;

  const client = getUnkeyClient();
  const tier = (opts.tier ?? "starter").toLowerCase();

  for (const row of rows) {
    const keyId = row.unkey_key_id;
    if (!keyId) continue;

    try {
      if (opts.subscriptionActive) {
        await client.keys.updateKey({
          keyId,
          enabled: true,
          ratelimits: ratelimitsForTier(tier),
        });
      } else {
        await client.keys.updateKey({
          keyId,
          enabled: false,
        });
      }
    } catch (e) {
      console.error("[unkey-user-sync] updateKey failed", keyId, e);
    }
  }
}
