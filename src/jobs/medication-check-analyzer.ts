import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { medicationCheckInputSchema } from "../contracts/medication-check-api";
import { mastra } from "../mastra";
import { getServiceSupabaseClient } from "../lib/supabase";

const schema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: medicationCheckInputSchema,
});

async function u(p: {
  jobId: string;
  status: "processing" | "completed" | "failed";
  payload: Record<string, unknown>;
  errorLog?: string | null;
}) {
  await getServiceSupabaseClient()
    .from("jobs")
    .update({ status: p.status, payload: p.payload, error_log: p.errorLog ?? null })
    .eq("id", p.jobId);
}

export const medicationCheckAnalyzer = task({
  id: "medication-check-analyzer",
  run: async (payload) => {
    const { jobId, organizationId, input } = schema.parse(payload);
    await u({ jobId, status: "processing", payload: { phase: "mastra_workflow_start" } });
    try {
      const wf = mastra.getWorkflow("medicationCheckWorkflow");
      const run = await wf.createRun();
      const res = await run.start({
        inputData: { job_id: jobId, organization_id: organizationId, input },
      });
      if (res.status !== "success") throw new Error(`medication_${res.status}`);
      await u({
        jobId,
        status: "completed",
        payload: {
          phase: "completed",
          output: res.result.output,
          diagnostics: res.result.diagnostics ?? [],
        },
      });
      await tasks.trigger("webhook-delivery", { orgId: organizationId, event: "job.completed", jobId });
      return { status: "completed" as const };
    } catch (error) {
      const m = error instanceof Error ? error.stack ?? error.message : "medication_failed";
      await u({
        jobId,
        status: "failed",
        payload: { phase: "failed", failure_code: "internal_step_failed" },
        errorLog: m,
      });
      await tasks.trigger("webhook-delivery", { orgId: organizationId, event: "job.failed", jobId });
      throw error;
    }
  },
});
