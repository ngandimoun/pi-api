import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { synthesizeWellness } from "@/lib/wellness/model-router";
import { step4WellnessOutputSchema } from "@/mastra/workflows/cognitive-wellness/schemas";

const FALLBACK_COACH =
  "Take regular breaks, hydrate, and consider speaking with a qualified professional if distress persists.";
const FALLBACK_DISCLAIMER =
  "This output is for wellness and educational purposes only. It is not medical or psychiatric advice or a diagnosis.";

export const step4WellnessCoachReport = createStep({
  id: "cognitive-wellness-step4-coach-report",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as {
      input: { image_data?: string };
      context?: Record<string, unknown>;
      output?: { locale?: string };
    };
    const step1 = raw.step1 as { locale?: string };
    const step2_decode_result = raw.step2_decode_result as Record<string, unknown>;
    const step3 = raw.step3 as Record<string, unknown>;

    const locale = input.output?.locale ?? step1.locale;
    const cognitive_state = { ...step3 };
    const eeg_decode = {
      ...step2_decode_result,
    };

    try {
      const { synthesis, huatuo_narrative, routing_fallbacks } = await synthesizeWellness({
        requestId: jobId,
        locale,
        image_data: input.input.image_data,
        cognitive_state,
        eeg_decode,
        context: input.context,
      });

      const coaching_message =
        synthesis.coaching_message?.trim() || FALLBACK_COACH;
      const disclaimer = synthesis.disclaimer?.trim() || FALLBACK_DISCLAIMER;

      const step4 = step4WellnessOutputSchema.parse({
        wellness_summary_refine: synthesis.wellness_summary,
        coaching_message,
        recommendations: synthesis.recommendations ?? [],
        clinical_style_summary: synthesis.clinical_style_summary,
        red_flags: synthesis.red_flags ?? [],
        disclaimer,
        routing_fallbacks,
        used_provider: synthesis.used_provider,
      });

      return {
        ...raw,
        step4,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_coach_report",
            started_at: started,
            status: "ok",
            detail: {
              routing_fallbacks,
              used_provider: synthesis.used_provider,
              huatuo_used: Boolean(huatuo_narrative),
            },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      const step4 = step4WellnessOutputSchema.parse({
        coaching_message: FALLBACK_COACH,
        recommendations: ["Rest and seek professional support if symptoms worsen."],
        red_flags: [],
        disclaimer: FALLBACK_DISCLAIMER,
        routing_fallbacks: [error instanceof Error ? error.message : "synthesis_failed"],
        used_provider: "static",
      });

      return {
        ...raw,
        step4,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_coach_report",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
