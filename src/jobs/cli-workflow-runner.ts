import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { mastra } from "@/mastra";

const workflowKeyEnum = z.enum([
  "cliValidateWorkflow",
  "cliLearnWorkflow",
  "cliRoutineWorkflow",
  "cliGraphBuilderWorkflow",
]);

const payloadSchema = z.object({
  workflow_key: workflowKeyEnum,
  organization_id: z.string().min(1),
  mastra_run_id: z.string().min(8),
  input_data: z.record(z.unknown()),
});

/**
 * Runs a Mastra Pi CLI workflow in the background (async API path).
 * The API creates the run first and passes `mastra_run_id` so clients can poll immediately.
 */
export const cliWorkflowRunner = task({
  id: "cli-workflow-runner",
  run: async (payload: unknown) => {
    const p = payloadSchema.parse(payload);
    const wf = mastra.getWorkflow(p.workflow_key);
    const run = await wf.createRun({ resourceId: p.organization_id, runId: p.mastra_run_id });
    const result = await run.start({ inputData: p.input_data as never });

    if (result.status === "success") {
      return {
        run_id: run.runId,
        workflow_status: result.status,
        result: result.result,
      };
    }
    if (result.status === "suspended") {
      return {
        run_id: run.runId,
        workflow_status: result.status,
        suspend_payload: result.suspendPayload,
        suspended: result.suspended,
      };
    }
    return {
      run_id: run.runId,
      workflow_status: result.status,
      error: "workflow_failed",
    };
  },
});
