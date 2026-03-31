import { z } from 'zod';

const MAX_CTX = 16_000;

export const scanAnalysisInputSchema = z.object({
  input: z.object({
    type: z.literal('medical_scan'),
    data: z.string().trim().min(1).max(8_000_000),
    modality: z.string().trim().min(1).max(64),
    clinical_question: z.string().trim().min(1).max(4000).optional(),
  }),
  context: z
    .record(z.unknown())
    .refine((c) => JSON.stringify(c).length <= MAX_CTX, { message: 'context too large' })
    .optional(),
  output: z
    .object({
      locale: z.string().trim().min(2).max(32).optional(),
      include_diagnostics: z.boolean().optional().default(false),
      format: z.enum(['report', 'json']).optional().default('json'),
    })
    .optional(),
});

export type ScanAnalysisInput = z.infer<typeof scanAnalysisInputSchema>;

export const scanAnalysisOutputSchema = z.object({
  findings: z
    .array(
      z.object({
        region: z.string().optional(),
        description: z.string(),
        severity: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .max(80)
    .default([]),
  impression: z.string().trim().min(1).max(16_000),
  plain_language_explanation: z.string().trim().min(1).max(16_000),
  anomalies_detected: z.boolean(),
  recommended_followup: z.string().trim().min(1).max(8000),
  urgency: z.enum(['stat', 'routine', 'non_urgent']),
  differential: z
    .array(
      z.object({
        condition: z.string(),
        likelihood: z.string().optional(),
      }),
    )
    .max(30)
    .default([]),
  measurements: z
    .array(
      z.object({
        structure: z.string(),
        value: z.string(),
        unit: z.string().optional(),
        normal_range: z.string().optional(),
      }),
    )
    .max(80)
    .default([]),
  disclaimer: z.string().trim().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

export type ScanAnalysisOutput = z.infer<typeof scanAnalysisOutputSchema>;

export const scanAnalysisDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(['ok', 'failed']),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type ScanAnalysisDiagnosticsStep = z.infer<typeof scanAnalysisDiagnosticsStepSchema>;
