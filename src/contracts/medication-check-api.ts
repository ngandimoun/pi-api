import { z } from "zod";

const MAX_CTX = 16_000;
const MAX_DATA = 200_000;

export const medicationCheckInputSchema = z.object({
  input: z.object({
    type: z.literal("medication_review"),
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
      })
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
      })
    )
    .max(40)
    .default([]),
  adherence_risk: z.enum(["high", "moderate", "low"]),
  adherence_barriers: z
    .array(
      z.object({
        medication: z.string(),
        barrier: z.string(),
        suggestion: z.string().optional(),
      })
    )
    .max(40)
    .default([]),
  optimization_suggestions: z
    .array(
      z.object({
        current: z.string(),
        suggested: z.string(),
        rationale: z.string().optional(),
      })
    )
    .max(40)
    .default([]),
  missing_medications: z
    .array(
      z.object({
        condition: z.string(),
        recommended_class: z.string(),
        rationale: z.string().optional(),
      })
    )
    .max(30)
    .default([]),
  dosing_alerts: z
    .array(
      z.object({
        medication: z.string(),
        issue: z.string(),
        recommendation: z.string().optional(),
      })
    )
    .max(40)
    .default([]),
  next_action: z.string().trim().min(1).max(8000),
  monitoring_plan: z
    .array(
      z.object({
        medication: z.string(),
        test: z.string(),
        frequency: z.string().optional(),
      })
    )
    .max(40)
    .default([]),
  patient_education: z.array(z.string()).max(40).default([]),
  risk_flags: z.array(z.string()).max(50).default([]),
  disclaimer: z.string().trim().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

export const medicationCheckDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});
