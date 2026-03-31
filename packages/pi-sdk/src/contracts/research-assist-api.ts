import { z } from 'zod';

const MAX_CTX = 16_000;
const MAX_DATA = 100_000;
const MAX_DATASET = 8_000_000;

export const researchAssistInputSchema = z.object({
  input: z.object({
    type: z.literal('research_query'),
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
    dataset: z.string().trim().min(1).max(MAX_DATASET).optional(),
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

export type ResearchAssistInput = z.infer<typeof researchAssistInputSchema>;

export const researchAssistOutputSchema = z.object({
  analysis_summary: z.string().trim().min(1).max(24_000),
  statistical_insights: z
    .array(
      z.object({
        test: z.string().optional(),
        result: z.string(),
        interpretation: z.string().optional(),
        p_value: z.string().optional(),
      }),
    )
    .max(40)
    .default([]),
  methodology_review: z.object({
    strengths: z.array(z.string()).max(30).default([]),
    weaknesses: z.array(z.string()).max(30).default([]),
    suggestions: z.array(z.string()).max(30).default([]),
  }),
  literature_connections: z
    .array(
      z.object({
        topic: z.string(),
        summary: z.string(),
        citations: z.array(z.string()).max(20).default([]),
      }),
    )
    .max(60)
    .default([]),
  recommended_next_steps: z.array(z.string()).max(40).default([]),
  limitations: z.array(z.string()).max(40).default([]),
  disclaimer: z.string().trim().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

export type ResearchAssistOutput = z.infer<typeof researchAssistOutputSchema>;

export const researchAssistDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(['ok', 'failed']),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type ResearchAssistDiagnosticsStep = z.infer<typeof researchAssistDiagnosticsStepSchema>;
