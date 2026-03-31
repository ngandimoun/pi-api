import { z } from 'zod';

const MAX_CTX = 16_000;
const MAX_DATA = 120_000;

export const decisionSupportInputSchema = z.object({
  input: z.object({
    type: z.literal('clinical_query'),
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
      }, 'input.data must be JSON string.'),
    structured_data: z.record(z.unknown()).optional(),
    guidelines: z.string().trim().min(1).max(64_000).optional(),
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

export type DecisionSupportInput = z.infer<typeof decisionSupportInputSchema>;

export const decisionSupportOutputSchema = z.object({
  recommended_action: z.string().trim().min(1).max(8000),
  reasoning: z.string().trim().min(1).max(24_000),
  confidence: z.number().min(0).max(1),
  alternatives: z
    .array(
      z.object({
        action: z.string(),
        rationale: z.string(),
        when_to_prefer: z.string().optional(),
      }),
    )
    .max(20)
    .default([]),
  contraindications: z.array(z.string()).max(40).default([]),
  evidence_references: z
    .array(
      z.object({
        guideline: z.string().optional(),
        recommendation: z.string(),
        strength: z.string().optional(),
      }),
    )
    .max(80)
    .default([]),
  red_flags: z.array(z.string()).max(50).default([]),
  disclaimer: z.string().trim().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

export type DecisionSupportOutput = z.infer<typeof decisionSupportOutputSchema>;

export const decisionSupportDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(['ok', 'failed']),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type DecisionSupportDiagnosticsStep = z.infer<typeof decisionSupportDiagnosticsStepSchema>;
