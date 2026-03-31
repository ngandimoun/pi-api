import { z } from "zod";

import { robotCommandSchema } from "@/contracts/robotics-api";
import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { ros2SendCommand } from "@/lib/robotics/ros2-bridge-client";
import { getRobot } from "@/lib/robotics/robot-manager";
import { getServiceSupabaseClient } from "@/lib/supabase";

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

const bodySchema = z.object({
  command: robotCommandSchema,
});

/**
 * Send a direct robot command (escape hatch API for devs).
 */
export const POST = withApiAuth(async (request, context) => {
  const rawParams = await Promise.resolve((context as { params?: unknown }).params ?? {});
  const parsedParams = paramsSchema.safeParse(rawParams);
  if (!parsedParams.success) {
    return apiZodError("invalid_path_params", parsedParams.error, 400, request.requestId);
  }
  const robotId = parsedParams.data.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return apiZodError("invalid_request_body", parsedBody.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  try {
    await getRobot({ supabase, orgId: request.organizationId, robotId });
  } catch {
    return apiError("robot_not_found", "Robot not found.", 404, request.requestId);
  }

  const res = await ros2SendCommand({
    robotId,
    command: parsedBody.data.command,
    requestId: request.requestId,
  });

  if (!res.ok) {
    return apiError("robot_command_failed", res.error ?? "Robot command failed.", 502, request.requestId, "api_error");
  }

  return apiSuccess(
    {
      robot_id: robotId,
      ok: true,
    },
    "robot.command",
    request.requestId
  );
});

