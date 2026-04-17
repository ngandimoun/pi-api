import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getRemoteCliTemplateById } from "@/lib/pi-cli-templates-registry";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/cli/templates/:id — fetch one registry template.
 */
export const GET = withApiAuth(async (request, ctx: RouteCtx) => {
  const requestId = request.requestId;
  const { id } = await ctx.params;
  const decoded = decodeURIComponent(id);
  const template = getRemoteCliTemplateById(decoded);
  if (!template) {
    return apiError("not_found", `Template not found: ${decoded}`, 404, requestId, "invalid_request_error");
  }
  const res = apiSuccessEnvelope({
    data: { template },
    object: "pi_cli_template",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
});
