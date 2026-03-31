import { z } from "zod";

const MAX_CONTEXT_JSON_CHARS = 16_000;

const localeSchema = z.string().trim().min(2).max(32).optional();

export const healthTriageInputSchema = z
  .object({
    input: z.object({
      type: z.enum(["image", "eeg"]),
      /**
       * Image: base64 (optionally with data: prefix) or https URL.
       * EEG: base64-encoded binary (recommended) OR JSON stringified payload.
       */
      data: z.string().trim().min(1).max(8_000_000),
      /**
       * Free-form modality string (extensible): xray, ultrasound, skin_lesion, eeg, ct_scan, etc.
       * Do not hardcode a closed list here; routing happens server-side.
       */
      modality: z.string().trim().min(1).max(64).optional(),
      /** Optional hint for images. */
      mime_type: z.string().trim().min(3).max(128).optional(),
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
        /**
         * When true, include debug-level information in job payload diagnostics.
         * This never changes the top-level developer response envelope.
         */
        include_diagnostics: z.boolean().optional().default(false),
        /**
         * Preferred response format. Defaults to a structured report.
         * (OpenAI-like callers can treat this as "response_format".)
         */
        format: z.enum(["report", "json"]).optional().default("report"),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.input.type === "image") {
      const m = (data.input.modality ?? "").trim();
      if (m.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "input.modality is required for image inputs (e.g. 'xray', 'ultrasound', 'skin_lesion').",
          path: ["input", "modality"],
        });
      }
    }
  });

export type HealthTriageInput = z.infer<typeof healthTriageInputSchema>;

export const healthTriageFindingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4000),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(z.string().trim().min(1).max(2000)).max(20).optional().default([]),
});

export const healthTriageOutputSchema = z.object({
  triage_level: z.enum(["critical", "urgent", "standard", "low"]),
  confidence: z.number().min(0).max(1),
  locale: localeSchema,
  findings: z.array(healthTriageFindingSchema).max(50).default([]),
  segmentation_overlay_url: z.string().url().nullable().default(null),
  seizure_detected: z.boolean().nullable().default(null),
  treatment_plan: z.string().trim().min(1).max(32000),
  referral_recommendation: z.string().trim().min(1).max(8000).optional(),
  red_flags: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  disclaimer: z.string().trim().min(1).max(8000),
});

export type HealthTriageOutput = z.infer<typeof healthTriageOutputSchema>;

export const healthTriageDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type HealthTriageDiagnosticsStep = z.infer<typeof healthTriageDiagnosticsStepSchema>;

