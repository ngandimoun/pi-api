import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { notesStructureInputSchema } from "../contracts/notes-structure-api";
import { mastra } from "../mastra";
import { getServiceSupabaseClient } from "../lib/supabase";

const schema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: notesStructureInputSchema,
});

async function updateJob(p: {
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

export const notesStructureAnalyzer = task({
  id: "notes-structure-analyzer",
  run: async (payload) => {
    const { jobId, organizationId, input } = schema.parse(payload);
    await updateJob({
      jobId,
      status: "processing",
      payload: { phase: "mastra_workflow_start", input: { has_context: Boolean(input.context) } },
    });
    try {
      const wf = mastra.getWorkflow("notesStructureWorkflow");
      const run = await wf.createRun();
      const result = await run.start({
        inputData: { job_id: jobId, organization_id: organizationId, input },
      });
      if (result.status !== "success") throw new Error(`notes_structure_${result.status}`);
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
      const message = error instanceof Error ? error.stack ?? error.message : "notes_job_failed";
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
