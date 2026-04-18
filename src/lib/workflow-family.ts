/**
 * Workflow / API families for per-tier Unkey quotas (Stripe → tier → limits).
 * Maps HTTP paths and Mastra workflow ids to a single family each.
 */

export const WORKFLOW_FAMILIES = [
  "cli",
  "health",
  "brand",
  "surveillance",
  "robotics",
  "voice",
  "images",
] as const;

export type WorkflowFamily = (typeof WORKFLOW_FAMILIES)[number];

export function isWorkflowFamily(s: string): s is WorkflowFamily {
  return (WORKFLOW_FAMILIES as readonly string[]).includes(s);
}

/** Unkey ratelimit `name` for monthly family buckets (must match keys.createKey / keys.updateKey). */
export function unkeyMonthlyRatelimitName(family: WorkflowFamily): string {
  if (family === "cli") return "cli_requests_monthly";
  return `${family}_monthly`;
}

/**
 * Builds Unkey `ratelimits` entries for a single HTTP request (billing mode).
 * Always consumes one `cli_requests_monthly` token; adds the path’s family bucket when not `cli`.
 */
export function buildBillingRatelimitsForPath(pathname: string): Array<{ name: string; cost: number }> {
  const family = inferWorkflowFamilyFromPathname(pathname);
  const limits: Array<{ name: string; cost: number }> = [{ name: unkeyMonthlyRatelimitName("cli"), cost: 1 }];
  if (family !== "cli") {
    limits.push({ name: unkeyMonthlyRatelimitName(family), cost: 1 });
  }
  return limits;
}

export function buildBillingRatelimitsForFamily(family: WorkflowFamily): Array<{ name: string; cost: number }> {
  const limits: Array<{ name: string; cost: number }> = [{ name: unkeyMonthlyRatelimitName("cli"), cost: 1 }];
  if (family !== "cli") {
    limits.push({ name: unkeyMonthlyRatelimitName(family), cost: 1 });
  }
  return limits;
}

/**
 * Infer family from a Next.js pathname (e.g. `/api/v1/health/analyze` → `health`).
 * `/api/cli/*` → `cli`. Unknown `/api/v1/*` defaults to `cli`.
 */
export function inferWorkflowFamilyFromPathname(pathname: string): WorkflowFamily {
  const p = pathname.replace(/\/+$/, "") || "/";

  if (p.startsWith("/api/cli")) return "cli";

  if (p.startsWith("/api/v1/health") || p.startsWith("/api/v1/neuro")) return "health";
  if (
    p.startsWith("/api/v1/brands") ||
    p.startsWith("/api/v1/campaigns") ||
    p.startsWith("/api/v1/ads") ||
    p.startsWith("/api/v1/jobs") ||
    p.startsWith("/api/v1/runs")
  ) {
    return "brand";
  }
  if (p.startsWith("/api/v1/surveillance")) return "surveillance";
  if (p.startsWith("/api/v1/robots")) return "robotics";
  if (p.startsWith("/api/v1/voice")) return "voice";
  if (p.startsWith("/api/v1/images") || p.startsWith("/api/v1/avatars")) return "images";

  if (p.startsWith("/api/v1")) return "cli";

  return "cli";
}

/** Mastra `listWorkflows()` id → family (must cover every workflow in `src/mastra/index.ts`). */
export const MASTRA_WORKFLOW_FAMILY_BY_ID: Record<string, WorkflowFamily> = {
  uppercaseWorkflow: "cli",
  campaignAdsWorkflow: "brand",
  campaignLocalizeWorkflow: "brand",
  healthTriageWorkflow: "health",
  neuroDecodeWorkflow: "health",
  cognitiveWellnessWorkflow: "health",
  patientRiskWorkflow: "health",
  adherenceWorkflow: "health",
  notesStructureWorkflow: "health",
  decisionSupportWorkflow: "health",
  medicationCheckWorkflow: "health",
  scanAnalysisWorkflow: "health",
  researchAssistWorkflow: "health",
  surveillanceStreamWorkflow: "surveillance",
  robotRunWorkflow: "robotics",
  cliValidateWorkflow: "cli",
  cliRoutineWorkflow: "cli",
  cliLearnWorkflow: "cli",
  cliGraphBuilderWorkflow: "cli",
  cliAdaptiveEngineWorkflow: "cli",
  cliGithubPrCheckWorkflow: "cli",
  cliResonateWorkflow: "cli",
};
