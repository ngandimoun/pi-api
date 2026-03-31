import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { adherenceStep3 } from "@/lib/clinical/gemini-adherence";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step3AdherenceRisk = createStep({
  id: "adherence-step3-risk-prediction",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const step1 = raw.step1 as { locale?: string; payload_json: string };
    const step2 = raw.step2 as Record<string, unknown>;
    try {
      const step3 = await adherenceStep3({
        requestId: jobId,
        locale: input.output?.locale ?? step1.locale,
        payloadJson: step1.payload_json,
        context: input.context,
        step2,
      });
      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_risk_prediction",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step3: {
          adherence_risk: "moderate",
          predicted_dropoff_window: "Unable to predict; manual review suggested.",
          escalation_triggers: [],
          risk_flags: ["prediction_degraded"],
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_risk_prediction",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
