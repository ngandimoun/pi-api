import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { mergeWellnessSummary } from "@/lib/wellness/gemini-wellness";
import { cognitiveWellnessWorkflowOutputSchema } from "@/mastra/workflows/cognitive-wellness/schemas";

const DEFAULT_DISCLAIMER =
  "This output is for wellness and educational purposes only. It is not medical or psychiatric advice or a diagnosis.";

export const step5WellnessReportAssembly = createStep({
  id: "cognitive-wellness-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: cognitiveWellnessWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const step1 = raw.step1 as { paradigm: string; has_image: boolean };
    const step2 = raw.step2 as { seizure_detected: boolean | null };
    const step3 = raw.step3 as {
      stress_band: string;
      fatigue_estimate: number;
      wellness_summary: string;
      attention_proxy?: number;
    };
    const step4 = raw.step4 as {
      wellness_summary_refine?: string;
      coaching_message: string;
      recommendations: string[];
      clinical_style_summary?: string;
      red_flags: string[];
      disclaimer: string;
    };

    const wellness_summary = mergeWellnessSummary({
      cognitive: step3.wellness_summary,
      synthesis: step4.wellness_summary_refine,
    });

    const clinical =
      step4.clinical_style_summary?.trim() && step4.clinical_style_summary.trim().length > 0
        ? step4.clinical_style_summary.trim().slice(0, 16_000)
        : undefined;

    const output = {
      wellness_summary,
      stress_band: step3.stress_band,
      fatigue_estimate: step3.fatigue_estimate,
      coaching_message: step4.coaching_message,
      recommendations: step4.recommendations,
      ...(clinical ? { clinical_style_summary: clinical } : {}),
      risk_flags: step4.red_flags,
      seizure_detected: step2.seizure_detected,
      disclaimer: step4.disclaimer?.trim() || DEFAULT_DISCLAIMER,
      metadata: {
        paradigm: step1.paradigm,
        has_image: step1.has_image,
        ...(typeof step3.attention_proxy === "number"
          ? { attention_proxy: step3.attention_proxy }
          : {}),
      },
    };

    return cognitiveWellnessWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
