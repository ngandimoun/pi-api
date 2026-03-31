import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { medicationStep2 } from "@/lib/clinical/gemini-medication";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step2MedicationSafety = createStep({
  id: "medication-check-step2-interaction-analysis",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const s1 = raw.step1 as { locale?: string; payload_json: string };
    try {
      const step2 = await medicationStep2({
        requestId: jobId,
        locale: input.output?.locale ?? s1.locale,
        payloadJson: s1.payload_json,
        context: input.context,
      });
      return {
        ...raw,
        step2,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_interaction_analysis",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step2: { interactions: [], contraindications: [], dosing_alerts: [] },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_interaction_analysis",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
