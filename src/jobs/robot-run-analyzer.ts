import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { robotRunInputSchema } from "../contracts/robotics-api";
import { mastraRobotics } from "../mastra/robotics";
import { getServiceSupabaseClient } from "../lib/supabase";

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: robotRunInputSchema,
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

export const robotRunAnalyzer = task({
  id: "robot-run-analyzer",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsed;

    await updateJob({
      jobId,
      status: "processing",
      payload: {
        phase: "mastra_workflow_start",
        input: {
          robot_id: input.robot_id,
          task: input.task,
          behaviors_count: input.behaviors?.length ?? 0,
          actions_count: input.actions?.length ?? 0,
        },
      },
    });

    try {
      const workflow = mastraRobotics.getWorkflow("robotRunWorkflow");
      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          job_id: jobId,
          organization_id: organizationId,
          input,
        },
      });

      if (result.status !== "success") {
        throw new Error(`robot_run_workflow_${result.status}`);
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
      const message = error instanceof Error ? error.stack ?? error.message : "robot_run_job_failed";
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

