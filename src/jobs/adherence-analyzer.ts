import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { adherenceInputSchema } from "../contracts/adherence-api";
import { mastra } from "../mastra";
import { getServiceSupabaseClient } from "../lib/supabase";

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: adherenceInputSchema,
});

async function updateJob(params: {
  jobId: string;
  status: "processing" | "completed" | "failed";
  payload: Record<string, unknown>;
  errorLog?: string | null;
}) {
  await getServiceSupabaseClient()
    .from("jobs")
    .update({
      status: params.status,
      payload: params.payload,
      error_log: params.errorLog ?? null,
    })
    .eq("id", params.jobId);
}

export const adherenceAnalyzer = task({
  id: "adherence-analyzer",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsed;

    await updateJob({
      jobId,
      status: "processing",
      payload: {
        phase: "mastra_workflow_start",
        input: { has_notes: Boolean(input.input.notes), has_context: Boolean(input.context) },
      },
    });

    try {
      const workflow = mastra.getWorkflow("adherenceWorkflow");
      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { job_id: jobId, organization_id: organizationId, input },
      });

      if (result.status !== "success") {
        throw new Error(`adherence_workflow_${result.status}`);
      }

      await updateJob({
        jobId,
        status: "completed",
        payload: {
          phase: "completed",
          output: result.result.output,
          diagnostics: result.result.diagnostics ?? [],
        },
      });

      await tasks.trigger("webhook-delivery", { orgId: organizationId, event: "job.completed", jobId });
      return { status: "completed" as const };
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : "adherence_job_failed";
      await updateJob({
        jobId,
        status: "failed",
        payload: { phase: "failed", failure_code: "internal_step_failed" },
        errorLog: message,
      });
      await tasks.trigger("webhook-delivery", { orgId: organizationId, event: "job.failed", jobId });
      throw error;
    }
  },
});
