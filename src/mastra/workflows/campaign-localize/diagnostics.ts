import { getServiceSupabaseClient } from "@/lib/supabase";

type CampaignStepStatus = "ok" | "failed";

type CampaignStepDiagnostic = {
  step: string;
  status: CampaignStepStatus;
  duration_ms: number;
  detail?: Record<string, unknown>;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toDiagnostics(value: unknown): CampaignStepDiagnostic[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as CampaignStepDiagnostic[];
}

export function appendInMemoryDiagnostic(
  inputData: Record<string, unknown>,
  diagnostic: CampaignStepDiagnostic
): CampaignStepDiagnostic[] {
  return [...toDiagnostics(inputData.diagnostics), diagnostic];
}

export async function appendJobDiagnostic(params: {
  jobId: string;
  diagnostic: CampaignStepDiagnostic;
  phase?: string;
}): Promise<void> {
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase.from("jobs").select("payload").eq("id", params.jobId).maybeSingle();
    if (error) return;

    const payload = toRecord(data?.payload);
    const diagnostics = [...toDiagnostics(payload.diagnostics), params.diagnostic];
    const nextPayload: Record<string, unknown> = {
      ...payload,
      phase: params.phase ?? payload.phase ?? "mastra_workflow_start",
      diagnostics,
    };

    await supabase.from("jobs").update({ payload: nextPayload }).eq("id", params.jobId);
  } catch {
    // Diagnostics must never fail the workflow.
  }
}
