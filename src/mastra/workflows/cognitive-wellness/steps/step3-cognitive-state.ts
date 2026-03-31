import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { inferCognitiveStateGemini } from "@/lib/wellness/gemini-wellness";
import { step3WellnessOutputSchema } from "@/mastra/workflows/cognitive-wellness/schemas";

const FALLBACK_STRESS = "moderate";
const FALLBACK_SUMMARY =
  "A detailed cognitive state could not be inferred from the available signals. Results should be interpreted cautiously.";

export const step3WellnessCognitiveState = createStep({
  id: "cognitive-wellness-step3-cognitive-state",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const step1 = raw.step1 as { locale?: string; paradigm: string };
    const decode = raw.step2_decode_result as {
      seizure_detected?: boolean | null;
      confidence?: number;
      detail?: Record<string, unknown>;
    };

    const eeg_decode = {
      paradigm: step1.paradigm,
      seizure_detected: decode?.seizure_detected ?? null,
      confidence: decode?.confidence,
      detail: decode?.detail ?? {},
    };

    const locale = input.output?.locale ?? step1.locale;

    try {
      const cognitive = await inferCognitiveStateGemini({
        requestId: jobId,
        locale,
        eeg_decode,
        context: input.context,
      });

      const step3 = step3WellnessOutputSchema.parse({
        ...cognitive,
        from_gemini: true,
      });

      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_cognitive_state",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      const step3 = step3WellnessOutputSchema.parse({
        stress_band: FALLBACK_STRESS,
        fatigue_estimate: 0.5,
        wellness_summary: FALLBACK_SUMMARY,
        from_gemini: false,
        notes: error instanceof Error ? error.message : "cognitive_infer_failed",
      });

      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_cognitive_state",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
