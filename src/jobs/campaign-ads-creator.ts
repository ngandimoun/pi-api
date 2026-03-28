import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { campaignAdGenerationInputSchema } from "@/contracts/campaign-ads-api";
import { mastra } from "@/mastra";
import { getServiceSupabaseClient } from "@/lib/supabase";

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: campaignAdGenerationInputSchema,
});

async function updateCampaignJob(
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

export const campaignAdsCreator = task({
  id: "campaign-ads-creator",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsed;

    await updateCampaignJob(jobId, "processing", {
      phase: "mastra_workflow_start",
      input: {
        prompt: input.prompt,
        reference_image_count: input.reference_images?.length ?? 0,
        output: input.output ?? undefined,
      },
    });

    try {
      const workflow = mastra.getWorkflow("campaignAdsWorkflow");
      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          job_id: jobId,
          organization_id: organizationId,
          input,
        },
      });

      if (result.status !== "success") {
        throw new Error(`campaign_workflow_${result.status}`);
      }

      await updateCampaignJob(
        jobId,
        "completed",
        {
          phase: "completed",
          image_url: result.result.result_url,
          diagnostics: result.result.diagnostics ?? [],
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
      const message = error instanceof Error ? error.message : "campaign_job_failed";
      await updateCampaignJob(
        jobId,
        "failed",
        {
          phase: "failed",
          failure_code: "internal_step_failed",
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
