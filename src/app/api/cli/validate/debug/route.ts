import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { isPiCliWorkflowModeEnabled } from "@/lib/pi-cli-workflows";
import { piCliMastraFourWorkflows as mastra } from "@/lib/pi-cli-mastra-four-workflows";

const bodySchema = z
  .object({
    run_id: z.string().min(8),
    workflow_key: z
      .enum(["cliValidateWorkflow", "cliRoutineWorkflow", "cliLearnWorkflow", "cliResonateWorkflow"])
      .optional(),
  })
  .strict();

/**
 * Audit/debug: load persisted workflow snapshot (time-travel / compliance).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  if (!isPiCliWorkflowModeEnabled()) {
    return apiError(
      "workflow_mode_disabled",
      "Debug snapshot requires PI_CLI_USE_WORKFLOWS=true and PI_CLI_DATABASE_URL.",
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
    const wf = mastra.getWorkflow(parsed.data.workflow_key ?? "cliValidateWorkflow");
    const snapshot = await wf.getWorkflowRunById(parsed.data.run_id, {
      withNestedWorkflows: true,
    });

    if (!snapshot) {
      return apiError("not_found", "Workflow run not found.", 404, requestId, "invalid_request_error");
    }

    const res = apiSuccessEnvelope({
      data: {
        run_id: parsed.data.run_id,
        workflow_key: parsed.data.workflow_key,
        snapshot,
      },
      object: "pi_cli_validate_debug",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Validate debug failed.";
    return apiError("validate_debug_failed", message, 500, requestId, "api_error");
  }
});
