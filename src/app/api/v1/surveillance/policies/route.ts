import { z } from "zod";

import { policyCreateInputSchema } from "@/contracts/surveillance-api";
import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const querySchema = z.object({
  stream_id: z.string().trim().min(1).max(256).optional(),
});

/**
 * List policies for the organization (optional `stream_id` filter).
 */
export const GET = withApiAuth(async (request) => {
  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    stream_id: url.searchParams.get("stream_id") ?? undefined,
  });
  if (!parsedQuery.success) {
    return apiError("invalid_query", "Invalid query parameters.", 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("surveillance_policies")
    .select("*")
    .eq("org_id", request.organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    return apiError("policy_list_failed", "Failed to list policies.", 500, request.requestId, "api_error");
  }

  const sid = parsedQuery.data.stream_id;
  const policies =
    sid ?
      (data ?? []).filter((p) => p.stream_id === sid || p.stream_id === "")
    : data ?? [];

  return apiSuccess({ policies }, "list", request.requestId);
});

/**
 * Create or update a surveillance policy (behavior rule).
 */
export const POST = withApiAuth(async (request) => {
  if (process.env.SURVEILLANCE_ENABLED?.trim() === "false") {
    return apiError(
      "surveillance_disabled",
      "Surveillance API is disabled.",
      403,
      request.requestId,
      "permission_error"
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = policyCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const row = {
    org_id: request.organizationId,
    stream_id: parsed.data.stream_id ?? "",
    name: parsed.data.name,
    type: parsed.data.type,
    condition: parsed.data.condition as unknown as Record<string, unknown>,
    action: (parsed.data.action ?? {}) as unknown as Record<string, unknown>,
    enabled: parsed.data.enabled,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("surveillance_policies")
      .update(row)
      .eq("id", parsed.data.id)
      .eq("org_id", request.organizationId)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return apiError("policy_update_failed", "Failed to update policy.", 500, request.requestId, "api_error");
    }
    return apiSuccess({ policy: data }, "surveillance.policy", request.requestId);
  }

  const { data, error } = await supabase
    .from("surveillance_policies")
    .upsert(row, { onConflict: "org_id,stream_id,name" })
    .select("*")
    .single();

  if (error || !data) {
    return apiError("policy_upsert_failed", "Failed to save policy.", 500, request.requestId, "api_error");
  }

  return apiSuccess({ policy: data }, "surveillance.policy", request.requestId);
});
