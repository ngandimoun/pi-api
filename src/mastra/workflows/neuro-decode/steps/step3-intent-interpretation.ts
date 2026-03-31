import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import type { MetabciEegResult } from "@/lib/health/metabci-client";
import { interpretIntent } from "@/lib/neuro/model-router";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { step3NeuroOutputSchema } from "@/mastra/workflows/neuro-decode/schemas";

export const step3NeuroIntentInterpretation = createStep({
  id: "neuro-decode-step3-intent-interpretation",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown> };
    const step1 = raw.step1 as { paradigm: string; locale?: string };
    const decode = raw.step2_decode_result as MetabciEegResult;

    try {
      const { result, routing_fallbacks } = await interpretIntent({
        requestId: jobId,
        paradigm: step1.paradigm,
        decode,
        context: input.context,
        locale: step1.locale,
      });

      const step3 = step3NeuroOutputSchema.parse({
        decoded_intent: result.decoded_intent,
        confidence: result.confidence,
        paradigm_detected: result.paradigm_detected,
        alternatives: result.alternatives,
        red_flags: result.red_flags,
        routing_fallbacks,
      });

      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_intent_interpretation",
            started_at: started,
            status: "ok",
            detail: { routing_fallbacks },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      const step3 = step3NeuroOutputSchema.parse({
        decoded_intent: "unknown",
        confidence: 0.25,
        paradigm_detected: step1.paradigm,
        alternatives: [],
        red_flags: ["decode_pipeline_uncertain"],
        routing_fallbacks: [],
      });
      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_intent_interpretation",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown_error" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
