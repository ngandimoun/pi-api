import { z } from "zod";

import { healthTriageInputSchema, healthTriageOutputSchema } from "../../../contracts/health-triage-api";

export const healthTriageDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export const healthTriageWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: healthTriageInputSchema,
});

export const step1OutputSchema = z.object({
  input_type: z.enum(["image", "eeg"]),
  modality: z.string().min(1),
  locale: z.string().optional(),
});

export const step2OutputSchema = z.object({
  segmentation_overlay_url: z.string().url().nullable().default(null),
  seizure_detected: z.boolean().nullable().default(null),
  processed_summary: z.string().min(1).max(8000).optional(),
});

export const step3OutputSchema = z.object({
  triage_level: z.enum(["critical", "urgent", "standard", "low"]),
  confidence: z.number().min(0).max(1),
  narrative: z.string().min(1),
  findings: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        confidence: z.number().min(0).max(1).optional(),
        evidence: z.array(z.string().min(1)).optional().default([]),
      })
    )
    .default([]),
  routing_fallbacks: z.array(z.string()).default([]),
});

export const step4OutputSchema = z.object({
  treatment_plan: z.string().min(1),
  referral_recommendation: z.string().optional(),
  red_flags: z.array(z.string().min(1)).default([]),
  disclaimer: z.string().min(1),
});

export const healthTriageWorkflowOutputSchema = z.object({
  output: healthTriageOutputSchema,
  diagnostics: z.array(healthTriageDiagnosticsStepSchema).default([]),
});

