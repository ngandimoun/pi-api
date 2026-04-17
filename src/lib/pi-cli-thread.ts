/**
 * Deterministic thread / resource ids for Pi CLI (no Mastra Memory import — safe for Next bundle).
 */

export function buildCliThreadId(params: {
  organizationId: string;
  branchName: string;
  developerId?: string;
}): string {
  const dev = (params.developerId ?? "local").trim() || "local";
  const branch = params.branchName.trim().replace(/\s+/g, "-") || "default";
  const safeOrg = params.organizationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `pi_cli_${safeOrg}_${dev}_${branch}`.slice(0, 256);
}

export function buildCliResourceId(organizationId: string): string {
  const safe = organizationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `pi_cli_org_${safe}`.slice(0, 256);
}
