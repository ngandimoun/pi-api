import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { predictText } from "@/lib/neuro/model-router";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { step4NeuroOutputSchema } from "@/mastra/workflows/neuro-decode/schemas";

export const step4NeuroPredictiveOutput = createStep({
  id: "neuro-decode-step4-predictive-output",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown> };
    const step1 = raw.step1 as { paradigm: string; locale?: string };
    const step3 = raw.step3 as { decoded_intent: string };

    try {
      const { result, routing_fallbacks } = await predictText({
        requestId: jobId,
        decoded_intent: step3.decoded_intent,
        paradigm: step1.paradigm,
        context: input.context,
        locale: step1.locale,
      });

      const step4 = step4NeuroOutputSchema.parse({
        predicted_text: result.predicted_text,
        session_context: result.session_context,
        routing_fallbacks,
      });

      return {
        ...raw,
        step4,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_predictive_output",
            started_at: started,
            status: "ok",
            detail: { routing_fallbacks },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      const step4 = step4NeuroOutputSchema.parse({
        predicted_text: step3.decoded_intent,
        session_context: undefined,
        routing_fallbacks: [],
      });
      return {
        ...raw,
        step4,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_predictive_output",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown_error" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
