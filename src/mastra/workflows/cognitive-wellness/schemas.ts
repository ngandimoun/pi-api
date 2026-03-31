import { z } from "zod";

import {
  cognitiveWellnessDiagnosticsStepSchema,
  cognitiveWellnessInputSchema,
  cognitiveWellnessOutputSchema,
} from "@/contracts/cognitive-wellness-api";

export { cognitiveWellnessDiagnosticsStepSchema };

export const cognitiveWellnessWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: cognitiveWellnessInputSchema,
});

export const step1WellnessOutputSchema = z.object({
  paradigm: z.string().min(1),
  locale: z.string().optional(),
  has_image: z.boolean(),
  device: z.string().optional(),
  channels: z.number().int().optional(),
  sample_rate: z.number().optional(),
});

export const step2WellnessOutputSchema = z.object({
  seizure_detected: z.boolean().nullable(),
  decode_confidence: z.number().min(0).max(1).optional(),
  decode_detail: z.record(z.unknown()).optional(),
  routing_fallbacks: z.array(z.string()),
});

export const step3WellnessOutputSchema = z.object({
  stress_band: z.string().min(1),
  fatigue_estimate: z.number().min(0).max(1),
  wellness_summary: z.string().min(1),
  attention_proxy: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
  from_gemini: z.boolean(),
});

export const step4WellnessOutputSchema = z.object({
  wellness_summary_refine: z.string().optional(),
  coaching_message: z.string().min(1),
  recommendations: z.array(z.string()),
  clinical_style_summary: z.string().optional(),
  red_flags: z.array(z.string()),
  disclaimer: z.string().min(1),
  routing_fallbacks: z.array(z.string()),
  used_provider: z.enum(["medgemma", "gemini", "static"]),
});

export const cognitiveWellnessWorkflowOutputSchema = z.object({
  output: cognitiveWellnessOutputSchema,
  diagnostics: z.array(cognitiveWellnessDiagnosticsStepSchema).default([]),
});
