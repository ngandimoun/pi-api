import { z } from "zod";

import { neuroDecodeInputSchema, neuroDecodeOutputSchema } from "@/contracts/neuro-decode-api";

export const neuroDecodeDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export const neuroDecodeWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: neuroDecodeInputSchema,
});

export const step1NeuroOutputSchema = z.object({
  paradigm: z.string().min(1),
  locale: z.string().optional(),
  device: z.string().optional(),
  channels: z.number().int().optional(),
  sample_rate: z.number().optional(),
});

export const step2NeuroOutputSchema = z.object({
  seizure_detected: z.boolean(),
  decode_confidence: z.number().min(0).max(1).optional(),
  decode_detail: z.record(z.unknown()).optional(),
  routing_fallbacks: z.array(z.string()),
});

export const step3NeuroOutputSchema = z.object({
  decoded_intent: z.string().min(1),
  confidence: z.number().min(0).max(1),
  paradigm_detected: z.string().min(1),
  alternatives: z
    .array(
      z.object({
        intent: z.string().min(1),
        confidence: z.number().min(0).max(1),
      })
    )
    .default([]),
  red_flags: z.array(z.string().min(1)).default([]),
  routing_fallbacks: z.array(z.string()).default([]),
});

export const step4NeuroOutputSchema = z.object({
  predicted_text: z.string().min(1),
  session_context: z.string().optional(),
  routing_fallbacks: z.array(z.string()).default([]),
});

export const neuroDecodeWorkflowOutputSchema = z.object({
  output: neuroDecodeOutputSchema,
  diagnostics: z.array(neuroDecodeDiagnosticsStepSchema).default([]),
});
