import { z } from "zod";

const MAX_CONTEXT_JSON_CHARS = 16_000;

const localeSchema = z.string().trim().min(2).max(32).optional();

export const neuroDecodeInputSchema = z.object({
  input: z.object({
    type: z.literal("eeg"),
    /**
     * Raw EEG payload: base64-encoded binary or JSON stringified array/tensor metadata.
     */
    data: z.string().trim().min(1).max(8_000_000),
    /** Free-form paradigm hint (motor_imagery, p300, ssvep, erp, etc.). */
    paradigm: z.string().trim().min(1).max(128),
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
      format: z.enum(["report", "json"]).optional().default("json"),
    })
    .optional(),
});

export type NeuroDecodeInput = z.infer<typeof neuroDecodeInputSchema>;

export const neuroDecodeAlternativeSchema = z.object({
  intent: z.string().trim().min(1).max(512),
  confidence: z.number().min(0).max(1),
});

export const neuroDecodeOutputSchema = z.object({
  decoded_intent: z.string().trim().min(1).max(512),
  confidence: z.number().min(0).max(1),
  paradigm_detected: z.string().trim().min(1).max(128),
  /** Optional sentence completion / accelerator text (mind-to-speech). */
  predicted_text: z.string().trim().min(1).max(16_000).optional(),
  alternatives: z.array(neuroDecodeAlternativeSchema).max(20).default([]),
  /** Echo or summarize multi-turn session state for the client. */
  session_context: z.string().trim().min(1).max(8000).optional(),
  /** Propagated from MetaBCI sidecar when available. */
  seizure_detected: z.boolean().nullable().optional(),
  red_flags: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  disclaimer: z.string().trim().min(1).max(8000),
});

export type NeuroDecodeOutput = z.infer<typeof neuroDecodeOutputSchema>;

export const neuroDecodeDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type NeuroDecodeDiagnosticsStep = z.infer<typeof neuroDecodeDiagnosticsStepSchema>;
