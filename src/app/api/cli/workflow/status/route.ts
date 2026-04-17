import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { isPiCliWorkflowModeEnabled } from "@/lib/pi-cli-workflows";
import { mastra } from "@/mastra";

const bodySchema = z
  .object({
    workflow_key: z.enum([
      "cliValidateWorkflow",
      "cliRoutineWorkflow",
      "cliLearnWorkflow",
      "cliGraphBuilderWorkflow",
      "cliAdaptiveEngineWorkflow",
      "cliGithubPrCheckWorkflow",
      "cliResonateWorkflow",
    ]),
    run_id: z.string().min(8),
  })
  .strict();

/**
 * Poll Mastra workflow run state (suspend/resume, audit).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  if (!isPiCliWorkflowModeEnabled()) {
    return apiError(
      "workflow_mode_disabled",
      "Workflow mode requires PI_CLI_USE_WORKFLOWS=true and PI_CLI_DATABASE_URL (or DATABASE_URL).",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid body.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  try {
    const wf = mastra.getWorkflow(parsed.data.workflow_key);
    const state = await wf.getWorkflowRunById(parsed.data.run_id, { withNestedWorkflows: true });
    if (!state) {
      return apiError("not_found", "Workflow run not found.", 404, requestId, "invalid_request_error");
    }

    const res = apiSuccessEnvelope({
      data: { workflow_run: state },
      object: "pi_cli_workflow_status",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Workflow status failed.";
    return apiError("workflow_status_failed", message, 500, requestId, "api_error");
  }
});
