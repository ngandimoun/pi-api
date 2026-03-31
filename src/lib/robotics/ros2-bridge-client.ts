import { z } from "zod";

import type { RobotCommand, RobotState } from "../../contracts/robotics-api";

function baseUrl(): string {
  const url = process.env.ROS2_BRIDGE_SERVICE_URL?.trim() || "http://localhost:8085";
  return url.replace(/\/$/, "");
}

const registerResponseSchema = z.object({
  ok: z.boolean(),
  robot_id: z.string(),
  mode: z.string(),
});

const commandResponseSchema = z.object({
  ok: z.boolean(),
  robot_id: z.string(),
  command: z.string(),
  mode: z.string(),
  detail: z.record(z.unknown()).optional(),
});

export async function ros2RegisterRobot(params: {
  robotId: string;
  rosNamespace?: string;
  metadata?: Record<string, unknown>;
  requestId: string;
}): Promise<{ ok: boolean; mode?: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/v1/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": params.requestId,
      },
      body: JSON.stringify({
        robot_id: params.robotId,
        ros_namespace: params.rosNamespace,
        metadata: params.metadata ?? {},
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `ros2_bridge_unreachable:${e instanceof Error ? e.message : "fetch_failed"}`,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `ros2_bridge_${res.status}:${text.slice(0, 500)}` };
  }

  const json = (await res.json()) as unknown;
  const parsed = registerResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "ros2_bridge_invalid_register_response" };
  return { ok: parsed.data.ok, mode: parsed.data.mode };
}

export async function ros2GetState(params: {
  robotId: string;
  requestId: string;
}): Promise<{ state: RobotState | null; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/v1/state?robot_id=${encodeURIComponent(params.robotId)}`, {
      method: "GET",
      headers: {
        "X-Request-Id": params.requestId,
      },
    });
  } catch (e) {
    return {
      state: null,
      error: `ros2_bridge_unreachable:${e instanceof Error ? e.message : "fetch_failed"}`,
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { state: null, error: `ros2_bridge_${res.status}:${text.slice(0, 500)}` };
  }
  const json = (await res.json()) as unknown;
  const state = z.custom<RobotState>().safeParse(json);
  if (!state.success) return { state: null, error: "ros2_bridge_invalid_state_response" };
  return { state: state.data };
}

export async function ros2SendCommand(params: {
  robotId: string;
  command: RobotCommand;
  requestId: string;
}): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/v1/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": params.requestId,
      },
      body: JSON.stringify({
        robot_id: params.robotId,
        command: params.command.command,
        target: params.command.target,
        message: params.command.message,
        params: params.command.params ?? {},
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `ros2_bridge_unreachable:${e instanceof Error ? e.message : "fetch_failed"}`,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `ros2_bridge_${res.status}:${text.slice(0, 500)}` };
  }

  const json = (await res.json()) as unknown;
  const parsed = commandResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "ros2_bridge_invalid_command_response" };
  return { ok: parsed.data.ok };
}

