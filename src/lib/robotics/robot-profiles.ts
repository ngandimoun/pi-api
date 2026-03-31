import type { RobotProfile, RobotRunInput } from "../../contracts/robotics-api";

type ProfilePartial = Pick<RobotRunInput, "task" | "behaviors" | "actions" | "outputs">;

export const ROBOT_PROFILES: Record<RobotProfile, ProfilePartial> = {
  patrol_security: {
    task: "patrol",
    behaviors: [{ type: "approach_on_incident", incident_type: "intrusion" }],
    actions: [
      {
        on: "intrusion",
        do: [{ type: "alert", severity: "critical" }],
      },
      {
        on: "loitering",
        do: [{ type: "alert", severity: "warning" }],
      },
    ],
    outputs: { delivery: ["sse"] },
  },
  warehouse_inspector: {
    task: "inspect",
    behaviors: [{ type: "speed_violation", zone: "loading_dock", max_speed_mps: 3 }],
    actions: [{ on: "speed_violation", do: [{ type: "alert", severity: "warning" }] }],
    outputs: { delivery: ["sse"] },
  },
  delivery_monitor: {
    task: "observe",
    behaviors: [{ type: "crowd_growth", zone: "dropoff", count: 20, window_sec: 120 }],
    actions: [{ on: "crowd_growth", do: [{ type: "alert", severity: "info" }] }],
    outputs: { delivery: ["sse"] },
  },
  agriculture_scout: {
    task: "observe",
    behaviors: [],
    actions: [],
    outputs: { delivery: ["sse"] },
  },
  cleaning_robot: {
    task: "patrol",
    behaviors: [],
    actions: [],
    outputs: { delivery: ["sse"] },
  },
  custom: {
    task: "custom",
    behaviors: [],
    actions: [],
    outputs: { delivery: ["sse"] },
  },
};

export function mergeRobotRunConfig(user: RobotRunInput, profile?: RobotProfile): RobotRunInput {
  if (!profile) return user;
  const base = ROBOT_PROFILES[profile];
  return {
    ...user,
    task: user.task ?? base.task ?? user.task,
    behaviors: user.behaviors?.length ? user.behaviors : base.behaviors ?? user.behaviors,
    actions: user.actions?.length ? user.actions : base.actions ?? user.actions,
    outputs: {
      delivery: user.outputs?.delivery ?? base.outputs?.delivery ?? ["sse"],
      webhook_url: user.outputs?.webhook_url ?? base.outputs?.webhook_url,
    },
    profile: user.profile ?? profile,
  };
}

