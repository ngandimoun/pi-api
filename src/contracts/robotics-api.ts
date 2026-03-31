import { z } from "zod";

import {
  behaviorRuleSchema,
  behaviorTargetTypeSchema,
  incidentSchema,
  streamSourceSchema,
} from "./surveillance-api";

const MAX_CONTEXT_JSON_CHARS = 16_000;

const localeSchema = z.string().trim().min(2).max(32).optional();

export const robotProfileSchema = z.enum([
  "patrol_security",
  "warehouse_inspector",
  "delivery_monitor",
  "agriculture_scout",
  "cleaning_robot",
  "custom",
]);

export type RobotProfile = z.infer<typeof robotProfileSchema>;

export const robotCapabilitySchema = z.enum([
  "navigation",
  "camera_rgb",
  "camera_depth",
  "speaker",
  "microphone",
  "arm_gripper",
  "lift",
  "thermal",
]);

export const robotConnectionSchema = z.object({
  /** URL to the ROS2 bridge HTTP service (Pi-managed sidecar). */
  ros2_bridge_url: z.string().url().optional(),
  /** Namespace for a robot in ROS/rosbridge (e.g. `/robot1`). */
  ros_namespace: z.string().trim().min(1).max(128).optional(),
  /** Vendor connector (kept opaque; Pi never hardcodes vendor details). */
  vendor: z.string().trim().min(1).max(64).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const robotRegisterInputSchema = z.object({
  robot_id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  capabilities: z.array(robotCapabilitySchema).max(32).default([]),
  connection: robotConnectionSchema.optional(),
  profile: robotProfileSchema.optional(),
  context: z
    .record(z.unknown())
    .refine((ctx) => JSON.stringify(ctx).length <= MAX_CONTEXT_JSON_CHARS, {
      message: `context must serialize to at most ${MAX_CONTEXT_JSON_CHARS} characters.`,
    })
    .optional(),
});

export type RobotRegisterInput = z.infer<typeof robotRegisterInputSchema>;

export const robotStateSchema = z.object({
  object: z.literal("robot.state"),
  robot_id: z.string(),
  status: z.enum(["offline", "idle", "busy", "error"]).default("idle"),
  battery_pct: z.number().min(0).max(100).nullable().optional(),
  position: z
    .object({
      frame: z.string().trim().min(1).max(64).default("map"),
      x: z.number(),
      y: z.number(),
      z: z.number().optional(),
      heading_deg: z.number().min(0).max(360).nullable().optional(),
    })
    .optional(),
  last_seen_at: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type RobotState = z.infer<typeof robotStateSchema>;

export const zoneTypeSchema = z.enum(["patrol", "restricted", "waypoint", "boundary", "custom"]);

export const zonePolygonSchema = z
  .array(z.tuple([z.number(), z.number()]))
  .min(3)
  .max(1024);

export const zoneDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  robot_id: z.string().trim().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(128),
  type: zoneTypeSchema.default("custom"),
  frame: z.string().trim().min(1).max(64).default("map"),
  polygon: zonePolygonSchema,
  metadata: z.record(z.unknown()).optional(),
});

export type ZoneDefinition = z.infer<typeof zoneDefinitionSchema>;

export const robotTaskSchema = z.enum([
  "patrol",
  "observe",
  "follow",
  "approach",
  "inspect",
  "custom",
]);

/**
 * Robot behavior rules build on the existing surveillance behavior DSL,
 * and add robot-specific control behaviors that can drive actions.
 */
export const robotBehaviorRuleSchema = z.discriminatedUnion("type", [
  ...(behaviorRuleSchema.options as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]]),
  z.object({
    type: z.literal("patrol"),
    waypoints: z.array(z.string().trim().min(1).max(128)).min(1).max(200),
    dwell_seconds: z.number().int().min(0).max(86_400).default(0),
    loop: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("follow_target"),
    target_class: z.string().trim().min(1).max(64).default("person"),
    max_distance_m: z.number().min(0.1).max(500).default(5),
  }),
  z.object({
    type: z.literal("approach_on_incident"),
    incident_type: behaviorTargetTypeSchema.optional(),
    zone: z.string().trim().min(1).max(128).optional(),
  }),
  z.object({
    type: z.literal("record_on_incident"),
    incident_type: behaviorTargetTypeSchema.optional(),
    seconds: z.number().int().min(1).max(86_400).default(30),
  }),
]);

export type RobotBehaviorRule = z.infer<typeof robotBehaviorRuleSchema>;

export const robotCommandTypeSchema = z.enum([
  "move_to",
  "stop",
  "follow",
  "record_start",
  "record_stop",
  "patrol_start",
  "patrol_stop",
  "announce",
]);

export const robotCommandSchema = z.object({
  command: robotCommandTypeSchema,
  target: z
    .object({
      frame: z.string().trim().min(1).max(64).default("map"),
      x: z.number().optional(),
      y: z.number().optional(),
      zone: z.string().trim().min(1).max(128).optional(),
      track_id: z.number().int().optional(),
    })
    .optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  params: z.record(z.unknown()).optional(),
});

export type RobotCommand = z.infer<typeof robotCommandSchema>;

export const robotActionTypeSchema = z.enum([
  "alert",
  "command",
  "webhook",
  "noop",
]);

export const robotActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("alert"),
    severity: z.enum(["info", "warning", "critical"]).default("warning"),
    message_template: z.string().trim().min(1).max(2000).optional(),
  }),
  z.object({
    type: z.literal("command"),
    command: robotCommandSchema,
  }),
  z.object({
    type: z.literal("webhook"),
    url: z.string().url(),
    method: z.enum(["POST", "PUT"]).default("POST"),
  }),
  z.object({
    type: z.literal("noop"),
  }),
]);

export type RobotAction = z.infer<typeof robotActionSchema>;

export const robotActionRuleSchema = z.object({
  on: z.enum([
    ...behaviorTargetTypeSchema.options,
    "patrol",
    "follow_target",
    "approach_on_incident",
    "record_on_incident",
  ]),
  do: z.array(robotActionSchema).min(1).max(32),
});

export type RobotActionRule = z.infer<typeof robotActionRuleSchema>;

export const robotPerceptionConfigSchema = z.object({
  source: streamSourceSchema.optional(),
  detect: z.array(z.string().trim().min(1).max(64)).max(64).default(["person"]),
  /** Single-frame perception sample (base64 or data URL). */
  input: z
    .object({
      data: z.string().trim().min(1).max(8_000_000),
      mime_type: z.string().trim().min(3).max(128).optional(),
    })
    .optional(),
  frame_index: z.number().int().min(0).default(0),
});

export type RobotPerceptionConfig = z.infer<typeof robotPerceptionConfigSchema>;

export const robotOutputsConfigSchema = z.object({
  delivery: z.array(z.enum(["sse", "webhook"])).min(1).max(8).default(["sse"]),
  webhook_url: z.string().url().optional(),
});

export const robotRunInputSchema = z
  .object({
    robot_id: z.string().trim().min(1).max(128),
    task: robotTaskSchema.default("patrol"),
    profile: robotProfileSchema.optional(),
    zones: z.array(zoneDefinitionSchema).max(200).default([]),
    behaviors: z.array(robotBehaviorRuleSchema).max(100).default([]),
    actions: z.array(robotActionRuleSchema).max(200).default([]),
    perception: robotPerceptionConfigSchema.optional(),
    outputs: robotOutputsConfigSchema.optional(),
    context: z
      .record(z.unknown())
      .refine((ctx) => JSON.stringify(ctx).length <= MAX_CONTEXT_JSON_CHARS, {
        message: `context must serialize to at most ${MAX_CONTEXT_JSON_CHARS} characters.`,
      })
      .optional(),
    output: z
      .object({
        locale: localeSchema,
        include_diagnostics: z.boolean().optional().default(false),
        format: z.enum(["report", "json"]).optional().default("json"),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const wantsWebhook = data.outputs?.delivery?.includes("webhook");
    if (wantsWebhook && !data.outputs?.webhook_url?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "outputs.webhook_url is required when delivery includes webhook.",
        path: ["outputs", "webhook_url"],
      });
    }
  });

export type RobotRunInput = z.infer<typeof robotRunInputSchema>;

export const robotRunEventSchema = z.object({
  id: z.string().uuid(),
  object: z.literal("robot.event"),
  robot_id: z.string(),
  created_at: z.number().int(),
  type: z.enum(["state", "incident", "action", "log"]),
  state: robotStateSchema.optional(),
  incident: incidentSchema.optional(),
  action: z
    .object({
      rule_on: z.string().optional(),
      executed: z.array(robotActionSchema).default([]),
      errors: z.array(z.string()).default([]),
    })
    .optional(),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type RobotRunEvent = z.infer<typeof robotRunEventSchema>;

export const robotRunOutputSchema = z.object({
  robot_id: z.string(),
  task: robotTaskSchema,
  state: robotStateSchema.optional(),
  incidents: z.array(incidentSchema).default([]),
  actions_executed: z.array(robotActionSchema).default([]),
  perception: z.unknown().optional(),
  actions_execution: z.array(z.unknown()).default([]),
});

export type RobotRunOutput = z.infer<typeof robotRunOutputSchema>;

