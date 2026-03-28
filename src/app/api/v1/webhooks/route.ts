import { z } from "zod";

import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const webhookCreateSchema = z.object({
  endpoint_url: z.string().url(),
  secret: z.string().trim().min(8).max(500),
});

export const GET = withApiAuth(async (request) => {
  const supabase = getServiceSupabaseClient();
  const { data: rows, error } = await supabase
    .from("webhooks")
    .select("id,endpoint_url,is_active,created_at,updated_at")
    .eq("org_id", request.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    return apiError(
      "list_failed",
      "Failed to list webhooks.",
      500,
      request.requestId,
      "api_error"
    );
  }

  return apiSuccess({ object: "list", data: rows ?? [] }, "list", request.requestId);
});

export const POST = withApiAuth(async (request) => {
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

  const parsed = webhookCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  if (!/^https:\/\//i.test(parsed.data.endpoint_url)) {
    return apiError(
      "invalid_endpoint_url",
      "Webhook endpoint_url must use HTTPS.",
      400,
      request.requestId
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data: row, error } = await supabase
    .from("webhooks")
    .insert({
      org_id: request.organizationId,
      endpoint_url: parsed.data.endpoint_url,
      secret: parsed.data.secret,
      is_active: true,
    })
    .select("id,endpoint_url,is_active,created_at,updated_at")
    .single();

  if (error || !row) {
    return apiError(
      "create_failed",
      "Failed to create webhook.",
      500,
      request.requestId,
      "api_error"
    );
  }

  return apiSuccess(
    { object: "webhook", ...row },
    "webhook",
    request.requestId
  );
});

