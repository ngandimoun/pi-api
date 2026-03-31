import { z } from 'zod';

const MAX_CTX = 16_000;
const MAX_DATA = 200_000;

export const medicationCheckInputSchema = z.object({
  input: z.object({
    type: z.literal('medication_review'),
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
      }, 'input.data must be JSON.'),
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

export type MedicationCheckInput = z.infer<typeof medicationCheckInputSchema>;

export const medicationCheckOutputSchema = z.object({
  interactions: z
    .array(
      z.object({
        drug_a: z.string(),
        drug_b: z.string(),
        severity: z.string().optional(),
        mechanism: z.string().optional(),
        recommendation: z.string().optional(),
      }),
    )
    .max(60)
    .default([]),
  contraindications: z
    .array(
      z.object({
        medication: z.string(),
        condition: z.string(),
        severity: z.string().optional(),
        recommendation: z.string().optional(),
      }),
    )
    .max(40)
    .default([]),
  duplicates: z.array(z.string()).max(60).default([]),
  monitoring_recommendations: z.array(z.string()).max(60).default([]),
  dosing_notes: z.array(z.string()).max(80).default([]),
  allergies: z.array(z.string()).max(40).default([]),
  renal_adjustments: z.array(z.string()).max(40).default([]),
  hepatic_adjustments: z.array(z.string()).max(40).default([]),
  pregnancy_lactation_notes: z.array(z.string()).max(40).default([]),
  top_concerns: z.array(z.string()).max(40).default([]),
  summary: z.string().trim().min(1).max(16_000),
  disclaimer: z.string().trim().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

export type MedicationCheckOutput = z.infer<typeof medicationCheckOutputSchema>;

export const medicationCheckDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(['ok', 'failed']),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type MedicationCheckDiagnosticsStep = z.infer<typeof medicationCheckDiagnosticsStepSchema>;
