import { z } from "zod";

import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { ros2GetState } from "@/lib/robotics/ros2-bridge-client";
import { getRobot } from "@/lib/robotics/robot-manager";
import { getServiceSupabaseClient } from "@/lib/supabase";

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

/**
 * Retrieve the current robot status (cached + sidecar live state when available).
 */
export const GET = withApiAuth(async (request, context) => {
  const rawParams = await Promise.resolve((context as { params?: unknown }).params ?? {});
  const parsedParams = paramsSchema.safeParse(rawParams);
  if (!parsedParams.success) {
    return apiZodError("invalid_path_params", parsedParams.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const robotId = parsedParams.data.id;

  let robot;
  try {
    robot = await getRobot({ supabase, orgId: request.organizationId, robotId });
  } catch (e) {
    // If the robotics tables haven't been migrated in the target Supabase yet,
    // we still want a usable status endpoint (best-effort state).
    robot = {
      robotId,
      name: robotId,
      connectionConfig: {},
      lastState: {},
      __warning: e instanceof Error ? e.message : "robot_lookup_failed",
    } as any;
  }

  const { state, error } = await ros2GetState({ robotId, requestId: request.requestId });

  return apiSuccess(
    {
      robot: {
        robot_id: robot.robotId,
        name: robot.name,
        connection: robot.connectionConfig,
      },
      state: state ?? null,
      warnings: [
        ...(error ? [error] : []),
        ...((robot as any).__warning ? [(robot as any).__warning] : []),
      ],
    },
    "robot.status",
    request.requestId
  );
});

