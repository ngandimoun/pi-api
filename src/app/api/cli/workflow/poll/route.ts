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

function mapWorkflowStatus(w: unknown): "pending" | "running" | "success" | "failed" | "suspended" {
  const r = w as { status?: string };
  const st = (r.status ?? "").toLowerCase();
  if (st === "success") return "success";
  if (st === "failed" || st === "error" || st === "canceled" || st === "cancelled") return "failed";
  if (st === "suspended") return "suspended";
  if (st === "pending" || st === "running" || st === "waiting") return "running";
  return "pending";
}

function extractWorkflowResult(state: unknown): unknown {
  if (!state || typeof state !== "object") return undefined;
  const o = state as Record<string, unknown>;
  if ("result" in o && o.result !== undefined) return o.result;
  const snap = o.snapshot;
  if (snap && typeof snap === "object") {
    const s = snap as Record<string, unknown>;
    if ("result" in s && s.result !== undefined) return s.result;
  }
  return undefined;
}

function extractSuspendPayload(state: unknown): unknown {
  if (!state || typeof state !== "object") return undefined;
  const o = state as Record<string, unknown>;
  if ("suspendPayload" in o && o.suspendPayload !== undefined) return o.suspendPayload;
  const snap = o.snapshot;
  if (snap && typeof snap === "object") {
    const s = snap as Record<string, unknown>;
    if ("suspendPayload" in s && s.suspendPayload !== undefined) return s.suspendPayload;
  }
  return undefined;
}

/**
 * Simplified workflow polling for Pi CLI async mode.
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

    const status = mapWorkflowStatus(state);
    const workflow_result = extractWorkflowResult(state);
    const suspend_payload = status === "suspended" ? extractSuspendPayload(state) : undefined;
    const res = apiSuccessEnvelope({
      data: {
        status,
        workflow_run: state,
        workflow_result: status === "success" || status === "suspended" ? workflow_result : undefined,
        suspend_payload,
      },
      object: "pi_cli_workflow_poll",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Workflow poll failed.";
    return apiError("workflow_poll_failed", message, 500, requestId, "api_error");
  }
});
