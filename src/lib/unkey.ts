import { Unkey } from "@unkey/api";
import { monthlyLimitForTier } from "@/lib/pi-cli-plan-limits";

/** ~30 days in ms for monthly CLI request quotas (Unkey window-based limits). */
export const CLI_MONTHLY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function ratelimitsForTier(tier: string | null | undefined) {
  const limit = monthlyLimitForTier(tier);
  return [
    {
      name: "cli_requests_monthly",
      limit,
      duration: CLI_MONTHLY_WINDOW_MS,
      autoApply: true,
    },
  ];
}

export type CreatePiApiKeyInput = {
  organizationId: string;
  name?: string;
  /** When false, verify fails with DISABLED until subscription activates. Default true. */
  enabled?: boolean;
  /** Optional tier for monthly ratelimit; ignored if disabled. */
  subscriptionTier?: string | null;
};

export type CreatePiApiKeyResult = {
  key: string;
  keyId: string | null;
  organizationId: string;
};

/**
 * Build a server-side Unkey client using environment variables.
 * Keep this module server-only and never expose root credentials client-side.
 */
export function getUnkeyClient(): Unkey {
  const rootKey = process.env.UNKEY_ROOT_KEY;

  if (!rootKey) {
    throw new Error("Missing UNKEY_ROOT_KEY");
  }

  return new Unkey({
    rootKey,
  });
}

/**
 * Verify a Pi API key against Unkey.
 */
export async function verifyUnkeyApiKey(apiKey: string) {
  const client = getUnkeyClient();

  return client.keys.verifyKey({
    key: apiKey,
  });
}

/**
 * Mint a new Pi API key in Unkey.
 *
 * Note: returns the *raw key* once; callers must show it immediately and never store it client-side.
 */
export async function createPiApiKey(
  input: CreatePiApiKeyInput
): Promise<CreatePiApiKeyResult> {
  const apiId = process.env.UNKEY_API_ID;
  if (!apiId) {
    throw new Error("Missing UNKEY_API_ID");
  }

  if (!input.organizationId) {
    throw new Error("Missing organizationId");
  }

  const client = getUnkeyClient();

  const enabled = input.enabled !== false;
  const tier = input.subscriptionTier ?? "starter";
  const ratelimits = enabled ? ratelimitsForTier(tier) : undefined;

  const resp = await client.keys.createKey({
    apiId,
    prefix: "pi",
    byteLength: 24,
    externalId: input.organizationId,
    enabled,
    ratelimits,
    meta: {
      organization_id: input.organizationId,
      ...(input.name ? { name: input.name } : {}),
    },
  });

  if (!resp.data?.key) {
    throw new Error(`Unkey createKey failed: missing key in response`);
  }

  return {
    key: resp.data.key,
    keyId: resp.data.keyId ?? null,
    organizationId: input.organizationId,
  };
}
