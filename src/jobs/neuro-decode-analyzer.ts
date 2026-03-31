import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { neuroDecodeInputSchema } from "../contracts/neuro-decode-api";
import { mastra } from "../mastra";
import { getServiceSupabaseClient } from "../lib/supabase";

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: neuroDecodeInputSchema,
});

async function updateJob(params: {
  jobId: string;
  status: "processing" | "completed" | "failed";
  payload: Record<string, unknown>;
  errorLog?: string | null;
}) {
  const supabase = getServiceSupabaseClient();
  await supabase
    .from("jobs")
    .update({
      status: params.status,
      payload: params.payload,
      error_log: params.errorLog ?? null,
    })
    .eq("id", params.jobId);
}

export const neuroDecodeAnalyzer = task({
  id: "neuro-decode-analyzer",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsed;

    await updateJob({
      jobId,
      status: "processing",
      payload: {
        phase: "mastra_workflow_start",
        input: {
          paradigm: input.input.paradigm,
          output: input.output ?? undefined,
          has_context: Boolean(input.context),
        },
      },
    });

    try {
      const workflow = mastra.getWorkflow("neuroDecodeWorkflow");
      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          job_id: jobId,
          organization_id: organizationId,
          input,
        },
      });

      if (result.status !== "success") {
        throw new Error(`neuro_decode_workflow_${result.status}`);
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

      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.completed",
        jobId,
      });

      return { status: "completed" as const };
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : "neuro_decode_job_failed";
      await updateJob({
        jobId,
        status: "failed",
        payload: {
          phase: "failed",
          failure_code: "internal_step_failed",
        },
        errorLog: message,
      });

      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.failed",
        jobId,
      });

      throw error;
    }
  },
});
