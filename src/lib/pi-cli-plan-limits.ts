import type { WorkflowFamily } from "@/lib/workflow-family";
import { WORKFLOW_FAMILIES } from "@/lib/workflow-family";

/** Monthly request / workflow-family limits per Stripe subscription tier. */
export type PiSubscriptionTier = "starter" | "pro" | "enterprise";

export const PI_WORKFLOW_MONTHLY_LIMITS: Record<PiSubscriptionTier, Record<WorkflowFamily, number>> = {
  starter: {
    cli: 1_000,
    health: 100,
    brand: 50,
    surveillance: 50,
    robotics: 50,
    voice: 100,
    images: 100,
  },
  pro: {
    cli: 10_000,
    health: 2_000,
    brand: 500,
    surveillance: 500,
    robotics: 500,
    voice: 2_000,
    images: 1_000,
  },
  enterprise: {
    cli: 100_000,
    health: 20_000,
    brand: 5_000,
    surveillance: 5_000,
    robotics: 5_000,
    voice: 20_000,
    images: 10_000,
  },
};

export function normalizeSubscriptionTier(tier: string | null | undefined): PiSubscriptionTier {
  const t = (tier ?? "starter").toLowerCase();
  if (t === "pro" || t === "enterprise" || t === "starter") return t;
  return "starter";
}

/** Monthly cap for the `cli` family (backward compat with legacy `monthlyLimitForTier`). */
export function monthlyLimitForTier(tier: string | null | undefined): number {
  return workflowMonthlyLimitForTier(tier, "cli");
}

export function workflowMonthlyLimitForTier(
  tier: string | null | undefined,
  family: WorkflowFamily,
): number {
  const t = normalizeSubscriptionTier(tier);
  return PI_WORKFLOW_MONTHLY_LIMITS[t][family];
}

export function workflowQuotaMatrixForTier(
  tier: string | null | undefined,
): Record<WorkflowFamily, number> {
  const t = normalizeSubscriptionTier(tier);
  const row = PI_WORKFLOW_MONTHLY_LIMITS[t];
  const out = {} as Record<WorkflowFamily, number>;
  for (const f of WORKFLOW_FAMILIES) {
    out[f] = row[f];
  }
  return out;
}
