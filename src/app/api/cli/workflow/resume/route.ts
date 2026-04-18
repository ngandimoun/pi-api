import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { piCliMastra as mastra } from "@/lib/pi-cli-mastra";

const bodySchema = z
  .object({
    workflow_key: z.enum(["cliRoutineWorkflow", "cliValidateWorkflow", "cliLearnWorkflow", "cliResonateWorkflow"]),
    run_id: z.string().min(8),
    step_id: z.string().optional(),
    resume_data: z.any(),
  })
  .strict();

/**
 * Resume a suspended Mastra workflow (HITL).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  if (!getMastraPostgresStore()) {
    return apiError(
      "workflow_mode_disabled",
      "Resume requires Postgres storage (PI_CLI_DATABASE_URL or DATABASE_URL).",
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
    const run = await wf.createRun({ runId: parsed.data.run_id });
    const step = parsed.data.step_id ?? "human-approval";
    const result = await run.resume({
      step,
      resumeData: parsed.data.resume_data,
    });

    const res = apiSuccessEnvelope({
      data: { workflow_result: result },
      object: "pi_cli_workflow_resume",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Workflow resume failed.";
    return apiError("workflow_resume_failed", message, 500, requestId, "api_error");
  }
});
