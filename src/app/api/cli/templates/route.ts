import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { listAllRemoteCliTemplates, registerCliTemplateTemplate } from "@/lib/pi-cli-templates-registry";
import { routineTemplateSchema } from "pi-routine-spec";

/**
 * GET /api/cli/templates — list registry templates (remote / env / memory).
 */
export const GET = withApiAuth(async (request) => {
  const requestId = request.requestId;
  const templates = listAllRemoteCliTemplates();
  const res = apiSuccessEnvelope({
    data: { templates },
    object: "pi_cli_template_list",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
});

const postBodySchema = routineTemplateSchema;

/**
 * POST /api/cli/templates — publish template (admin).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;
  const adminSecret = process.env.PI_TEMPLATES_ADMIN_SECRET?.trim();
  const headerSecret = request.headers.get("x-pi-templates-admin")?.trim();
  if (!adminSecret || headerSecret !== adminSecret) {
    return apiError("forbidden", "Template admin secret required.", 403, requestId, "permission_error");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid template.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  registerCliTemplateTemplate(parsed.data);
  const res = apiSuccessEnvelope({
    data: { template: parsed.data, stored: "memory" as const },
    object: "pi_cli_template",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
});
