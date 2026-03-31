import { z } from "zod";

const MAX_CONTEXT_JSON_CHARS = 16_000;
const MAX_PATIENT_DATA_CHARS = 120_000;

const localeSchema = z.string().trim().min(2).max(32).optional();

export const patientRiskInputSchema = z.object({
  input: z.object({
    type: z.literal("patient_data"),
    data: z
      .string()
      .trim()
      .min(1)
      .max(MAX_PATIENT_DATA_CHARS)
      .refine((s) => {
        try {
          JSON.parse(s);
          return true;
        } catch {
          return false;
        }
      }, "input.data must be valid JSON string (vitals, notes, history, labs)."),
    image_data: z.string().trim().min(1).max(8_000_000).optional(),
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

export type PatientRiskInput = z.infer<typeof patientRiskInputSchema>;

export const patientRiskOutputSchema = z.object({
  risk_level: z.enum(["critical", "high", "moderate", "low"]),
  priority_rank_rationale: z.string().trim().min(1).max(16_000),
  next_action: z.string().trim().min(1).max(8000),
  recommended_actions: z.array(z.string().trim().min(1).max(2000)).max(40).default([]),
  time_sensitivity: z.enum(["immediate", "hours", "days", "weeks"]),
  escalation_triggers: z.array(z.string().trim().min(1).max(1000)).max(50).default([]),
  differential_considerations: z.array(z.string().trim().min(1).max(2000)).max(40).default([]),
  resource_requirements: z.array(z.string().trim().min(1).max(2000)).max(40).default([]),
  risk_flags: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  disclaimer: z.string().trim().min(1).max(8000),
  clinical_style_summary: z.string().trim().min(1).max(16_000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PatientRiskOutput = z.infer<typeof patientRiskOutputSchema>;

export const patientRiskDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type PatientRiskDiagnosticsStep = z.infer<typeof patientRiskDiagnosticsStepSchema>;
