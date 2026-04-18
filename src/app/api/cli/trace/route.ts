import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { isPiCliWorkflowModeEnabled } from "@/lib/pi-cli-workflows";
import { piCliMastra as mastra } from "@/lib/pi-cli-mastra";

const traceBodySchema = z
  .object({
    run_id: z.string().min(8).max(200),
    workflow_key: z.enum(["cliValidateWorkflow", "cliRoutineWorkflow", "cliLearnWorkflow", "cliResonateWorkflow"]).optional(),
  })
  .strict();

function appBaseUrlCandidates(): string[] {
  const bases = [
    process.env.PI_APP_BASE_URL?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : undefined,
  ].filter(Boolean) as string[];

  // De-dupe while preserving order
  const out: string[] = [];
  for (const b of bases) {
    const norm = b.replace(/\/+$/, "");
    if (!out.includes(norm)) out.push(norm);
  }
  return out;
}

/**
 * pi trace — return workflow snapshot + helpful deep links for auditing decisions.
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  if (!isPiCliWorkflowModeEnabled()) {
    return apiError(
      "workflow_mode_disabled",
      "Trace requires PI_CLI_USE_WORKFLOWS=true and PI_CLI_DATABASE_URL.",
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

  const parsed = traceBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid body.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  const workflowKey = parsed.data.workflow_key ?? "cliValidateWorkflow";

  try {
    const wf = mastra.getWorkflow(workflowKey);
    const snapshot = await wf.getWorkflowRunById(parsed.data.run_id, {
      withNestedWorkflows: true,
    });

    if (!snapshot) {
      return apiError("not_found", "Workflow run not found.", 404, requestId, "invalid_request_error");
    }

    const bases = appBaseUrlCandidates();
    /** Mastra workflow id → `/api/cli/<segment>/debug` path (camelCase keys from schema). */
    const debugPathByWorkflow: Record<
      "cliValidateWorkflow" | "cliRoutineWorkflow" | "cliLearnWorkflow" | "cliResonateWorkflow",
      string
    > = {
      cliValidateWorkflow: "validate",
      cliRoutineWorkflow: "routine",
      cliLearnWorkflow: "learn",
      cliResonateWorkflow: "resonate",
    };
    const debugPath = debugPathByWorkflow[workflowKey];
    const links = bases.map((base) => ({
      label: `${debugPath}_debug_api`,
      url: `${base}/api/cli/${debugPath}/debug`,
      method: "POST" as const,
      body: { run_id: parsed.data.run_id, workflow_key: workflowKey },
    }));

    const res = apiSuccessEnvelope({
      data: {
        run_id: parsed.data.run_id,
        workflow_key: workflowKey,
        snapshot,
        links,
        notes: [
          "This endpoint mirrors /api/cli/validate/debug but adds deep-link candidates for humans.",
          "Use the validate debug API with the same Unkey-authenticated Authorization header as other Pi CLI routes.",
        ],
      },
      object: "pi_cli_trace",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Trace failed.";
    return apiError("trace_failed", message, 500, requestId, "api_error");
  }
});
