import { z } from 'zod';

const MAX_CONTEXT_JSON_CHARS = 16_000;

const localeSchema = z.string().trim().min(2).max(32).optional();

export const cognitiveWellnessInputSchema = z.object({
  input: z.object({
    type: z.literal('eeg'),
    data: z.string().trim().min(1).max(8_000_000),
    /** Paradigm / session hint: cognitive_wellness, focus_task, game_screening, etc. */
    modality: z.string().trim().min(1).max(128).optional(),
    /** Optional screenshot (game UI, task) for vision-assisted synthesis when Huatuo is configured. */
    image_data: z.string().trim().min(1).max(8_000_000).optional(),
    device: z.string().trim().min(1).max(128).optional(),
    channels: z.number().int().min(1).max(1024).optional(),
    sample_rate: z.number().positive().max(1_000_000).optional(),
  }),
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
      format: z.enum(['report', 'json']).optional().default('json'),
    })
    .optional(),
});

export type CognitiveWellnessInput = z.infer<typeof cognitiveWellnessInputSchema>;

export const cognitiveWellnessOutputSchema = z.object({
  wellness_summary: z.string().trim().min(1).max(4000),
  /** Free-form band label (e.g. low, moderate, elevated) — not a clinical scale. */
  stress_band: z.string().trim().min(1).max(64),
  fatigue_estimate: z.number().min(0).max(1),
  coaching_message: z.string().trim().min(1).max(16_000),
  recommendations: z.array(z.string().trim().min(1).max(2000)).max(30).default([]),
  clinical_style_summary: z.string().trim().min(1).max(16_000).optional(),
  risk_flags: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  seizure_detected: z.boolean().nullable().optional(),
  disclaimer: z.string().trim().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

export type CognitiveWellnessOutput = z.infer<typeof cognitiveWellnessOutputSchema>;

export const cognitiveWellnessDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(['ok', 'failed']),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type CognitiveWellnessDiagnosticsStep = z.infer<
  typeof cognitiveWellnessDiagnosticsStepSchema
>;
