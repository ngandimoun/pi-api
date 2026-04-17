import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PiCliGovernanceMode = "strict" | "permissive" | "disabled";
export type PiCliRole = "admin" | "tech_lead" | "developer" | "viewer";

export function getPiCliGovernanceMode(): PiCliGovernanceMode {
  const m = process.env.PI_CLI_GOVERNANCE_MODE?.trim().toLowerCase();
  if (m === "strict" || m === "permissive" || m === "disabled") return m;
  return "disabled";
}

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Resolve CLI caller role for governance. When governance is disabled, behaves as admin.
 * Without DB row in strict mode, defaults to developer (least privilege).
 */
export async function resolvePiCliRole(organizationId: string, developerId: string): Promise<PiCliRole> {
  const mode = getPiCliGovernanceMode();
  if (mode === "disabled") return "admin";

  const sb = getSupabaseAdmin();
  if (!sb) {
    return mode === "strict" ? "developer" : "admin";
  }

  const { data, error } = await sb
    .from("pi_cli_developers")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("id", developerId)
    .maybeSingle();

  if (error || !data?.role) {
    return mode === "strict" ? "developer" : "admin";
  }
  return data.role as PiCliRole;
}

export function canPersistTeamSystemStyle(role: PiCliRole): boolean {
  return role === "admin" || role === "tech_lead";
}

export async function logPiCliGovernanceAction(params: {
  organizationId: string;
  developerId: string;
  action: string;
  details?: Record<string, unknown>;
  approvedBy?: string;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    await sb.from("pi_cli_governance_log").insert({
      organization_id: params.organizationId,
      developer_id: params.developerId,
      action: params.action,
      details: params.details ?? null,
      approved_by: params.approvedBy ?? null,
    });
  } catch (e) {
    console.warn("[pi-cli-governance] log_failed", e);
  }
}

export async function insertResonateDraft(params: {
  id: string;
  organizationId: string;
  developerId: string;
  proposedSystemStyle: Record<string, unknown>;
  summary?: string;
}): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const { error } = await sb.from("pi_cli_resonate_drafts").insert({
      id: params.id,
      organization_id: params.organizationId,
      developer_id: params.developerId,
      proposed_system_style: params.proposedSystemStyle,
      summary: params.summary ?? null,
      status: "pending",
    });
    if (error) {
      console.warn("[pi-cli-governance] draft_insert_failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[pi-cli-governance] draft_insert_failed", e);
    return false;
  }
}

export async function getResonateDraft(
  id: string,
  organizationId: string
): Promise<{
  id: string;
  proposed_system_style: Record<string, unknown>;
  status: string;
  developer_id: string;
} | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("pi_cli_resonate_drafts")
    .select("id, proposed_system_style, status, developer_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    id: string;
    proposed_system_style: Record<string, unknown>;
    status: string;
    developer_id: string;
  };
}

export async function resolveResonateDraft(params: {
  id: string;
  organizationId: string;
  status: "approved" | "rejected";
  resolvedBy: string;
}): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const { error } = await sb
      .from("pi_cli_resonate_drafts")
      .update({
        status: params.status,
        resolved_at: new Date().toISOString(),
        resolved_by: params.resolvedBy,
      })
      .eq("id", params.id)
      .eq("organization_id", params.organizationId);
    return !error;
  } catch {
    return false;
  }
}
