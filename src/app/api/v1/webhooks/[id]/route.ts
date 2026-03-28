import { z } from "zod";

import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const webhookUpdateSchema = z.object({
  is_active: z.boolean().optional(),
});

async function resolveRouteParams(
  params: unknown
): Promise<Record<string, string | string[]> | undefined> {
  if (!params) return undefined;
  if (typeof (params as Promise<unknown>).then === "function") {
    const awaited = await (params as Promise<unknown>);
    if (awaited && typeof awaited === "object") {
      return awaited as Record<string, string | string[]>;
    }
    return undefined;
  }
  if (typeof params === "object") return params as Record<string, string | string[]>;
  return undefined;
}

export const PATCH = withApiAuth(async (request, context) => {
  const resolvedParams = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolvedParams ?? {});
  if (!parsedParams.success) {
    return apiZodError("invalid_id", parsedParams.error, 400, request.requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(
      "invalid_json_body",
      "Request body must be valid JSON.",
      400,
      request.requestId
    );
  }

  const parsedBody = webhookUpdateSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiZodError("invalid_request_body", parsedBody.error, 400, request.requestId);
  }

  if (parsedBody.data.is_active === undefined) {
    return apiError(
      "no_changes",
      "No updatable fields provided.",
      400,
      request.requestId
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data: row, error } = await supabase
    .from("webhooks")
    .update({ is_active: parsedBody.data.is_active })
    .eq("id", parsedParams.data.id)
    .eq("org_id", request.organizationId)
    .select("id,endpoint_url,is_active,created_at,updated_at")
    .maybeSingle();

  if (error || !row) {
    return apiError("not_found", "Webhook not found.", 404, request.requestId);
  }

  return apiSuccess({ object: "webhook", ...row }, "webhook", request.requestId);
});

