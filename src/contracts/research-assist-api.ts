import { z } from "zod";

const MAX_CTX = 16_000;
const MAX_DATA = 100_000;
const MAX_DATASET = 8_000_000;

export const researchAssistInputSchema = z.object({
  input: z.object({
    type: z.literal("research_query"),
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
      }, "input.data must be JSON."),
    dataset: z.string().trim().min(1).max(MAX_DATASET).optional(),
  }),
  context: z
    .record(z.unknown())
    .refine((c) => JSON.stringify(c).length <= MAX_CTX, { message: "context too large" })
    .optional(),
  output: z
    .object({
      locale: z.string().trim().min(2).max(32).optional(),
      include_diagnostics: z.boolean().optional().default(false),
      format: z.enum(["report", "json"]).optional().default("json"),
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
      })
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
        finding: z.string(),
        related_work: z.string().optional(),
        implication: z.string().optional(),
      })
    )
    .max(30)
    .default([]),
  next_steps: z.array(z.string()).max(40).default([]),
  data_quality_issues: z
    .array(
      z.object({
        column: z.string().optional(),
        issue: z.string(),
        recommendation: z.string().optional(),
      })
    )
    .max(40)
    .default([]),
  visualization_suggestions: z
    .array(
      z.object({
        chart_type: z.string(),
        variables: z.string().optional(),
        rationale: z.string().optional(),
      })
    )
    .max(20)
    .default([]),
  draft_sections: z
    .object({
      abstract: z.string().optional(),
      methods: z.string().optional(),
      results: z.string().optional(),
      discussion: z.string().optional(),
    })
    .optional(),
  ethical_considerations: z.array(z.string()).max(30).default([]),
  disclaimer: z.string().trim().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

export const researchAssistDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});
