import { Unkey } from "@unkey/api";
import { PI_WORKFLOW_MONTHLY_LIMITS, normalizeSubscriptionTier } from "@/lib/pi-cli-plan-limits";
import {
  WORKFLOW_FAMILIES,
  buildBillingRatelimitsForPath,
  buildBillingRatelimitsForFamily,
  unkeyMonthlyRatelimitName,
  type WorkflowFamily,
} from "@/lib/workflow-family";

/** ~30 days in ms for monthly quotas (Unkey window-based limits). */
export const CLI_MONTHLY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type VerifyUnkeyMode = "billing" | "identity";

/** Normalize Unkey SDK verify responses across versions (`data` vs nested `data.data`). */
export function getUnkeyVerifyPayload(verify: unknown): Record<string, unknown> | undefined {
  const v = verify as { data?: Record<string, unknown> };
  const top = v.data;
  if (!top) return undefined;
  if (typeof top.valid === "boolean") {
    return top;
  }
  const inner = top.data as Record<string, unknown> | undefined;
  if (inner && typeof inner.valid === "boolean") {
    return inner;
  }
  return undefined;
}

/**
 * Standalone Unkey verify for CLI + a workflow family (e.g. Trigger.dev worker that holds the user API key).
 * Do **not** call after `withApiAuth` on the same request — auth already consumed matching buckets.
 */
export async function enforceWorkflowQuota(
  apiKey: string,
  family: WorkflowFamily,
): Promise<{ ok: boolean; code?: string }> {
  const client = getUnkeyClient();
  const res = await client.keys.verifyKey({
    key: apiKey,
    ratelimits: buildBillingRatelimitsForFamily(family),
  });
  const data = getUnkeyVerifyPayload(res);
  return { ok: data?.valid === true, code: typeof data?.code === "string" ? data.code : undefined };
}

/**
 * All per-family monthly limits attached to each key (Stripe tier).
 * `autoApply` is false — consumption is explicit via `verifyKey({ ratelimits: [...] })` on `/api/v1/*`.
 * Exception: identity-only checks omit `ratelimits` and therefore do not consume quota.
 */
export function ratelimitsForTier(tier: string | null | undefined) {
  const t = normalizeSubscriptionTier(tier);
  const row = PI_WORKFLOW_MONTHLY_LIMITS[t];
  return WORKFLOW_FAMILIES.map((family) => ({
    name: unkeyMonthlyRatelimitName(family),
    limit: row[family],
    duration: CLI_MONTHLY_WINDOW_MS,
    autoApply: false,
  }));
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
 *
 * @param pathname — Request pathname (e.g. `/api/v1/health/analyze`). Used in `billing` mode only.
 * @param mode — `billing` (default): enforce + consume monthly quotas for path family + CLI aggregate.
 *              `identity`: key validity only (no quota burn) — use for `/api/cli/auth/verify` and tooling.
 */
export async function verifyUnkeyApiKey(
  apiKey: string,
  pathname?: string | null,
  mode: VerifyUnkeyMode = "billing",
) {
  const client = getUnkeyClient();

  if (mode === "identity") {
    return client.keys.verifyKey({
      key: apiKey,
    });
  }

  const path = pathname ?? "/";
  const ratelimits = buildBillingRatelimitsForPath(path);

  return client.keys.verifyKey({
    key: apiKey,
    ratelimits,
  });
}

/**
 * Mint a new Pi API key in Unkey.
 *
 * Note: returns the *raw key* once; callers must show it immediately and never store it client-side.
 */
export async function createPiApiKey(input: CreatePiApiKeyInput): Promise<CreatePiApiKeyResult> {
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
