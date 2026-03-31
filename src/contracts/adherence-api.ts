import { z } from "zod";

const MAX_CONTEXT = 16_000;
const MAX_DATA = 200_000;

const localeSchema = z.string().trim().min(2).max(32).optional();

export const adherenceInputSchema = z.object({
  input: z.object({
    type: z.literal("patient_timeline"),
    data: z
      .string()
      .trim()
      .min(1)
      .max(MAX_DATA)
      .refine((s) => {
        try {
          JSON.parse(s);
          return true;
        } catch {
          return false;
        }
      }, "input.data must be valid JSON."),
    notes: z.string().trim().min(1).max(64_000).optional(),
  }),
  context: z
    .record(z.unknown())
    .refine((ctx) => JSON.stringify(ctx).length <= MAX_CONTEXT, {
      message: `context must serialize to at most ${MAX_CONTEXT} characters.`,
    })
    .optional(),
  output: z
    .object({
      locale: localeSchema,
      include_diagnostics: z.boolean().optional().default(false),
      format: z.enum(["report", "json"]).optional().default("json"),
    })
    .optional(),
});

export type AdherenceInput = z.infer<typeof adherenceInputSchema>;

export const adherenceOutputSchema = z.object({
  adherence_risk: z.enum(["high", "moderate", "low"]),
  next_action: z.string().trim().min(1).max(8000),
  missed_items: z
    .array(
      z.object({
        type: z.string().trim().min(1).max(128),
        description: z.string().trim().min(1).max(4000),
        date: z.string().trim().max(64).optional(),
        severity: z.string().trim().max(64).optional(),
      })
    )
    .max(80)
    .default([]),
  predicted_dropoff_window: z.string().trim().min(1).max(2000),
  intervention_recommendations: z.array(z.string().trim().min(1).max(2000)).max(40).default([]),
  engagement_score: z.number().min(0).max(1),
  barriers_detected: z.array(z.string().trim().min(1).max(1000)).max(40).default([]),
  escalation_triggers: z.array(z.string().trim().min(1).max(1000)).max(40).default([]),
  risk_flags: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  disclaimer: z.string().trim().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

export type AdherenceOutput = z.infer<typeof adherenceOutputSchema>;

export const adherenceDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});
