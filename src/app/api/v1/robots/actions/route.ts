import { z } from "zod";

import { robotActionRuleSchema } from "@/contracts/robotics-api";
import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const querySchema = z.object({
  behavior_id: z.string().uuid().optional(),
});

const bodySchema = z.object({
  behavior_id: z.string().uuid().optional(),
  rule: robotActionRuleSchema,
  enabled: z.boolean().optional().default(true),
});

/**
 * Action rules (MVP): store action mappings (behavior -> actions) for reuse.
 */
export const GET = withApiAuth(async (request) => {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    behavior_id: url.searchParams.get("behavior_id") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("invalid_query", "Invalid query parameters.", 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  let q = supabase
    .from("robot_actions")
    .select("id,behavior_id,on_type,action_type,config,enabled,created_at,updated_at")
    .eq("org_id", request.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (parsed.data.behavior_id) {
    q = q.eq("behavior_id", parsed.data.behavior_id);
  }

  const { data, error } = await q;
  if (error) {
    return apiError("actions_list_failed", "Failed to list actions.", 500, request.requestId, "api_error");
  }

  return apiSuccess({ actions: data ?? [] }, "robot.actions.list", request.requestId);
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

  const { behavior_id, rule, enabled } = parsed.data;
  const supabase = getServiceSupabaseClient();

  // Store one row per action in the rule (normalized for querying).
  const rows = rule.do.map((act) => ({
    org_id: request.organizationId,
    behavior_id: behavior_id ?? null,
    on_type: rule.on,
    action_type: act.type,
    config: act as unknown as Record<string, unknown>,
    enabled,
  }));

  const { error } = await supabase.from("robot_actions").insert(rows);
  if (error) {
    return apiError("actions_create_failed", "Failed to create actions.", 500, request.requestId, "api_error");
  }

  return apiSuccess({ created: rows.length }, "robot.actions.create", request.requestId);
});

