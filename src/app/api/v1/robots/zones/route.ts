import { z } from "zod";

import { zoneDefinitionSchema } from "@/contracts/robotics-api";
import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const querySchema = z.object({
  robot_id: z.string().trim().min(1).max(128).optional(),
});

const bodySchema = z.object({
  zones: z.array(zoneDefinitionSchema).min(1).max(200),
});

/**
 * Zones CRUD (MVP): store zone definitions (polygons) for an org (optionally scoped to a robot_id).
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
    .from("robot_zones")
    .select("id,robot_id,name,zone_type,frame,polygon,metadata,created_at,updated_at")
    .eq("org_id", request.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (parsed.data.robot_id) {
    q = q.eq("robot_id", parsed.data.robot_id);
  }

  const { data, error } = await q;
  if (error) {
    return apiError("zones_list_failed", "Failed to list zones.", 500, request.requestId, "api_error");
  }

  return apiSuccess({ zones: data ?? [] }, "robot.zones.list", request.requestId);
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
  const rows = parsed.data.zones.map((z) => ({
    org_id: request.organizationId,
    robot_id: z.robot_id ?? null,
    name: z.name,
    zone_type: z.type,
    frame: z.frame,
    polygon: z.polygon,
    metadata: z.metadata ?? {},
  }));

  const { error } = await supabase.from("robot_zones").insert(rows);
  if (error) {
    return apiError("zones_create_failed", "Failed to create zones.", 500, request.requestId, "api_error");
  }

  return apiSuccess({ created: rows.length }, "robot.zones.create", request.requestId);
});

