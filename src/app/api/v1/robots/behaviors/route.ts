import { z } from "zod";

import { robotBehaviorRuleSchema } from "@/contracts/robotics-api";
import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const querySchema = z.object({
  robot_id: z.string().trim().min(1).max(128).optional(),
});

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  robot_id: z.string().trim().min(1).max(128).optional(),
  rule: robotBehaviorRuleSchema,
  enabled: z.boolean().optional().default(true),
});

/**
 * Behavior definitions (MVP): store named behaviors for reuse in robot runs.
 */
export const GET = withApiAuth(async (request) => {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    robot_id: url.searchParams.get("robot_id") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("invalid_query", "Invalid query parameters.", 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  let q = supabase
    .from("robot_behaviors")
    .select("id,robot_id,name,type,condition,enabled,created_at,updated_at")
    .eq("org_id", request.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (parsed.data.robot_id) {
    q = q.eq("robot_id", parsed.data.robot_id);
  }

  const { data, error } = await q;
  if (error) {
    return apiError("behaviors_list_failed", "Failed to list behaviors.", 500, request.requestId, "api_error");
  }

  return apiSuccess({ behaviors: data ?? [] }, "robot.behaviors.list", request.requestId);
});

export const POST = withApiAuth(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const { name, robot_id, rule, enabled } = parsed.data;

  const { error } = await supabase.from("robot_behaviors").insert({
    org_id: request.organizationId,
    robot_id: robot_id ?? null,
    name,
    type: rule.type,
    condition: rule as unknown as Record<string, unknown>,
    enabled,
  });

  if (error) {
    return apiError("behaviors_create_failed", "Failed to create behavior.", 500, request.requestId, "api_error");
  }

  return apiSuccess({ ok: true }, "robot.behaviors.create", request.requestId);
});

