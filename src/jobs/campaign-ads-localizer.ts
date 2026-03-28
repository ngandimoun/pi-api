import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { campaignAdLocalizationInputSchema } from "@/contracts/campaign-localize-api";
import { mastra } from "@/mastra";
import { getServiceSupabaseClient } from "@/lib/supabase";

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: campaignAdLocalizationInputSchema,
});

async function updateCampaignLocalizationJob(
  jobId: string,
  status: "processing" | "completed" | "failed",
  payload: Record<string, unknown>,
  errorLog?: string | null,
  resultUrl?: string | null
) {
  const supabase = getServiceSupabaseClient();
  await supabase
    .from("jobs")
    .update({
      status,
      payload,
      error_log: errorLog ?? null,
      result_url: resultUrl ?? null,
    })
    .eq("id", jobId);
}

async function getExistingJobDiagnostics(jobId: string): Promise<Record<string, unknown>[]> {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase.from("jobs").select("payload").eq("id", jobId).maybeSingle();
  const payload = data?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const diagnostics = (payload as Record<string, unknown>).diagnostics;
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
}

async function getExistingJobPayload(jobId: string): Promise<Record<string, unknown>> {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase.from("jobs").select("payload").eq("id", jobId).maybeSingle();
  const payload = data?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

function buildDiagnosticsFromWorkflowSteps(result: unknown): Record<string, unknown>[] {
  const steps = (result as { steps?: Record<string, unknown> })?.steps;
  if (!steps || typeof steps !== "object") return [];

  return Object.entries(steps)
    .filter(([stepId]) => stepId !== "input")
    .map(([stepId, value]) => {
      const step = value as Record<string, unknown>;
      const startedAt = Number(step.startedAt ?? 0);
      const endedAt = Number(step.endedAt ?? startedAt);
      const rawStatus = String(step.status ?? "failed");

      return {
        step: stepId,
        status: rawStatus === "success" ? "ok" : "failed",
        duration_ms: Math.max(0, endedAt - startedAt),
        detail:
          rawStatus === "success"
            ? {}
            : {
                error: typeof step.error === "string" ? step.error : "step_failed",
              },
      };
    });
}

function buildLocalizationStepFallback(status: "ok" | "failed"): Record<string, unknown>[] {
  const steps = [
    "campaign-localize-step1-cultural-understanding",
    "campaign-localize-step2-localization-summary",
    "campaign-localize-step3-cultural-retrieval",
    "campaign-localize-step4-cultural-reasoning",
    "campaign-localize-step5-localized-json-prompt",
    "campaign-localize-step6-localized-generation",
  ];
  return steps.map((step) => ({
    step,
    status,
    duration_ms: 0,
    detail: { inferred: true },
  }));
}

export const campaignAdsLocalizer = task({
  id: "campaign-ads-localizer",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsed;

    await updateCampaignLocalizationJob(jobId, "processing", {
      phase: "mastra_workflow_start",
      diagnostics: [],
      input: {
        prompt: input.prompt,
        source_job_id: input.source_job_id ?? undefined,
        target_culture: input.target_culture,
        target_language: input.target_language ?? undefined,
        target_currency: input.target_currency ?? undefined,
        brand_id: input.brand_id ?? undefined,
        reference_image_count: input.reference_images?.length ?? 0,
        output: input.output ?? undefined,
      },
    });

    try {
      const workflow = mastra.getWorkflow("campaignLocalizeWorkflow");
      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          job_id: jobId,
          organization_id: organizationId,
          input,
        },
      });

      if (result.status !== "success") {
        throw new Error(`campaign_localize_workflow_${result.status}`);
      }
      const existingDiagnostics = await getExistingJobDiagnostics(jobId);
      const existingPayload = await getExistingJobPayload(jobId);
      const workflowDiagnostics = Array.isArray(result.result.diagnostics) ? result.result.diagnostics : [];
      const runtimeDiagnostics = buildDiagnosticsFromWorkflowSteps(result);
      const diagnostics =
        existingDiagnostics.length > 0
          ? existingDiagnostics
          : workflowDiagnostics.length > 0
            ? workflowDiagnostics
            : runtimeDiagnostics.length > 0
              ? runtimeDiagnostics
              : buildLocalizationStepFallback("ok");

      await updateCampaignLocalizationJob(
        jobId,
        "completed",
        {
          ...existingPayload,
          phase: "completed",
          image_url: result.result.result_url,
          diagnostics,
        },
        null,
        result.result.result_url
      );

      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.completed",
        jobId,
      });

      return {
        status: "completed" as const,
        result_url: result.result.result_url,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "campaign_localization_failed";
      const existingPayload = await getExistingJobPayload(jobId);
      const existingDiagnostics = await getExistingJobDiagnostics(jobId);
      await updateCampaignLocalizationJob(
        jobId,
        "failed",
        {
          ...existingPayload,
          phase: "failed",
          failure_code: "internal_step_failed",
          diagnostics:
            existingDiagnostics.length > 0
              ? existingDiagnostics
              : [
                  ...buildLocalizationStepFallback("failed"),
                  {
                    step: "campaign-localize-workflow",
                    status: "failed",
                    duration_ms: 0,
                    detail: { error: message },
                  },
                ],
        },
        message
      );

      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.failed",
        jobId,
      });

      throw error;
    }
  },
});

