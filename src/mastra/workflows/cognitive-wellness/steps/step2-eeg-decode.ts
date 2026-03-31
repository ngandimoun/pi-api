import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { runEegDecode } from "@/lib/wellness/model-router";
import { step2WellnessOutputSchema } from "@/mastra/workflows/cognitive-wellness/schemas";

export const step2WellnessEegDecode = createStep({
  id: "cognitive-wellness-step2-eeg-decode",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as {
      input: { data: string; image_data?: string };
      context?: Record<string, unknown>;
    };
    const step1 = raw.step1 as {
      paradigm: string;
      device?: string;
      channels?: number;
      sample_rate?: number;
    };

    try {
      const { result, routing_fallbacks } = await runEegDecode({
        requestId: jobId,
        paradigm: step1.paradigm,
        data: input.input.data,
        device: step1.device,
        channels: step1.channels,
        sample_rate: step1.sample_rate,
        context: input.context,
      });

      const step2 = step2WellnessOutputSchema.parse({
        seizure_detected: result.seizure_detected ?? null,
        decode_confidence: result.confidence,
        decode_detail: result.detail,
        routing_fallbacks,
      });

      const usedGemini = routing_fallbacks.some((x) => x.includes("gemini"));
      return {
        ...raw,
        step2_decode_result: result,
        step2,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_eeg_decode",
            started_at: started,
            status: "ok",
            detail: { routing_fallbacks, used_gemini_fallback: usedGemini },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      const step2 = step2WellnessOutputSchema.parse({
        seizure_detected: null,
        decode_confidence: 0,
        decode_detail: { error: error instanceof Error ? error.message : "unknown" },
        routing_fallbacks: [error instanceof Error ? error.message : "decode_failed"],
      });
      return {
        ...raw,
        step2_decode_result: {
          seizure_detected: false,
          confidence: 0,
          detail: step2.decode_detail,
        },
        step2,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_eeg_decode",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown_error" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
