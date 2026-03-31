import { z } from 'zod';

const MAX_CONTEXT_JSON_CHARS = 16_000;

const localeSchema = z.string().trim().min(2).max(32).optional();

/** Source for a monitored stream (URL-based MVP; RTSP ingestion is operator-side). */
export const streamSourceSchema = z.object({
  url: z.string().trim().min(1).max(4096),
  type: z.enum(['rtsp', 'http', 'file']).default('http'),
  fps_cap: z.number().int().min(1).max(120).optional(),
});

export const behaviorTargetTypeSchema = z.enum([
  'loitering',
  'intrusion',
  'crowd_growth',
  'object_left',
  'perimeter_breach',
  'speed_violation',
  'wrong_direction',
]);

/** Discriminated union for behavior rules. */
export const behaviorRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('loitering'),
    zone: z.string().trim().min(1).max(128),
    seconds: z.number().int().min(1).max(86_400),
  }),
  z.object({
    type: z.literal('intrusion'),
    zone: z.string().trim().min(1).max(128),
    classes: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
  }),
  z.object({
    type: z.literal('crowd_growth'),
    zone: z.string().trim().min(1).max(128),
    count: z.number().int().min(1).max(10_000),
    window_sec: z.number().int().min(1).max(3600),
  }),
  z.object({
    type: z.literal('object_left'),
    zone: z.string().trim().min(1).max(128),
    seconds: z.number().int().min(1).max(86_400),
  }),
  z.object({
    type: z.literal('perimeter_breach'),
    zone: z.string().trim().min(1).max(128),
    boundary: z.enum(['inside', 'outside']).optional(),
  }),
  z.object({
    type: z.literal('speed_violation'),
    zone: z.string().trim().min(1).max(128),
    max_speed_mps: z.number().min(0).max(200),
  }),
  z.object({
    type: z.literal('wrong_direction'),
    zone: z.string().trim().min(1).max(128),
    allowed_heading_deg: z.number().min(0).max(360),
    tolerance_deg: z.number().min(0).max(180).default(60),
  }),
]);

export const anomalyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sensitivity: z.number().min(0).max(1).default(0.7),
});

export const outputsConfigSchema = z.object({
  delivery: z
    .array(z.enum(['sse', 'webhook', 'email']))
    .min(1)
    .max(8)
    .default(['sse']),
  format: z.enum(['summary', 'detailed', 'raw']).default('summary'),
  webhook_url: z.string().url().optional(),
  email: z.string().email().optional(),
});

export const alertsConfigSchema = z.object({
  min_severity: z.enum(['info', 'warning', 'critical']).default('info'),
  cooldown_seconds: z.number().int().min(0).max(3600).default(30),
  group_by: z.enum(['zone', 'type', 'track']).default('zone'),
});

export const surveillanceProfileSchema = z.enum([
  'retail_security',
  'warehouse_safety',
  'smart_city',
  'residential_perimeter',
  'construction_site',
  'parking_lot',
  'school_campus',
  'healthcare_facility',
]);

export type SurveillanceProfile = z.infer<typeof surveillanceProfileSchema>;

export const streamCreateInputSchema = z
  .object({
    stream_id: z.string().trim().min(1).max(256).optional(),
    source: streamSourceSchema,
    detect: z.array(z.string().trim().min(1).max(64)).max(64).default(['person']),
    behaviors: z.array(behaviorRuleSchema).max(50).default([]),
    anomaly: anomalyConfigSchema.optional(),
    outputs: outputsConfigSchema.optional(),
    alerts: alertsConfigSchema.optional(),
    profile: surveillanceProfileSchema.optional(),
    context: z
      .record(z.unknown())
      .refine((ctx) => JSON.stringify(ctx).length <= MAX_CONTEXT_JSON_CHARS, {
        message: `context must serialize to at most ${MAX_CONTEXT_JSON_CHARS} characters.`,
      })
      .optional(),
    /** Single-frame perception sample (base64 or data URL). Optional when operator ingests frames server-side. */
    input: z
      .object({
        data: z.string().trim().min(1).max(8_000_000),
        mime_type: z.string().trim().min(3).max(128).optional(),
      })
      .optional(),
    frame_index: z.number().int().min(0).default(0),
    output: z
      .object({
        locale: localeSchema,
        include_diagnostics: z.boolean().optional().default(false),
        format: z.enum(['report', 'json']).optional().default('json'),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.input?.data?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'input.data is required for this endpoint (provide a base64 or data: URL frame).',
        path: ['input', 'data'],
      });
    }
    if (data.outputs?.delivery?.includes('webhook') && !data.outputs.webhook_url?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'outputs.webhook_url is required when delivery includes webhook.',
        path: ['outputs', 'webhook_url'],
      });
    }
    if (data.outputs?.delivery?.includes('email') && !data.outputs.email?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'outputs.email is required when delivery includes email.',
        path: ['outputs', 'email'],
      });
    }
  });

export type StreamCreateInput = z.infer<typeof streamCreateInputSchema>;

export type BehaviorRule = z.infer<typeof behaviorRuleSchema>;

/** Policy row (stored in Supabase). */
export const policyConditionSchema = z.object({
  zone: z.string().trim().min(1).max(128).optional(),
  duration_seconds: z.number().int().min(1).max(86_400).optional(),
  count_threshold: z.number().int().min(1).max(10_000).optional(),
  window_sec: z.number().int().min(1).max(3600).optional(),
  speed_threshold_mps: z.number().min(0).max(200).optional(),
  direction_deg: z.number().min(0).max(360).optional(),
  boundary: z.enum(['inside', 'outside']).optional(),
});

export const policyActionSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  message_template: z.string().trim().min(1).max(2000).optional(),
  cooldown_seconds: z.number().int().min(0).max(3600).default(30),
});

export const policyCreateInputSchema = z.object({
  id: z.string().uuid().optional(),
  stream_id: z.string().trim().min(1).max(256).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  type: z.enum([
    'loitering',
    'intrusion',
    'crowd_growth',
    'object_left',
    'perimeter_breach',
    'speed_violation',
    'wrong_direction',
    'custom',
  ]),
  condition: policyConditionSchema.default({}),
  action: policyActionSchema.optional(),
  enabled: z.boolean().default(true),
});

export type PolicyCreateInput = z.infer<typeof policyCreateInputSchema>;

/** Detection from Python orchestrator / YOLO. */
export const detectionSchema = z.object({
  cls: z.number().int().optional(),
  label: z.string(),
  conf: z.number(),
  xyxy: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

export const trackSchema = z.object({
  track_id: z.number().int(),
  conf: z.number(),
  cls: z.number().int().nullable().optional(),
  xyxy: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

export const actionPredictionSchema = z.object({
  label: z.string(),
  score: z.number(),
});

export const perceptionResultSchema = z.object({
  object: z.literal('surveillance.perception'),
  stream_id: z.string(),
  frame_index: z.number().int().nonnegative(),
  detections: z.array(detectionSchema),
  tracks: z.array(trackSchema),
  actions: z.array(actionPredictionSchema),
  anomaly_score: z.number().nullable().optional(),
  meta: z.record(z.unknown()).optional(),
});

export type PerceptionResult = z.infer<typeof perceptionResultSchema>;

export const incidentNarrationSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  description: z.string().trim().min(1).max(8000),
  recommended_action: z.string().trim().min(1).max(4000).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type IncidentNarration = z.infer<typeof incidentNarrationSchema>;

export const incidentSchema = z.object({
  id: z.string().uuid(),
  object: z.literal('surveillance.incident'),
  stream_id: z.string(),
  type: behaviorTargetTypeSchema,
  severity: z.enum(['info', 'warning', 'critical']),
  created_at: z.number().int(),
  detections: z.array(detectionSchema),
  tracks: z.array(trackSchema),
  anomaly_score: z.number().nullable().optional(),
  narration: incidentNarrationSchema.optional(),
  policy_matched: z
    .object({
      id: z.string().uuid().optional(),
      name: z.string().optional(),
    })
    .optional(),
  zone: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Incident = z.infer<typeof incidentSchema>;

export const streamAnalysisOutputSchema = z.object({
  stream_id: z.string(),
  perception: perceptionResultSchema,
  incidents: z.array(incidentSchema),
});

export type StreamAnalysisOutput = z.infer<typeof streamAnalysisOutputSchema>;
