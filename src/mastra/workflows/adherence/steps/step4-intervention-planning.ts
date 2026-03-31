import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { adherenceStep4 } from "@/lib/clinical/gemini-adherence";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step4AdherenceInterventions = createStep({
  id: "adherence-step4-intervention-planning",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const step1 = raw.step1 as { locale?: string; payload_json: string };
    const step2 = raw.step2 as Record<string, unknown>;
    const step3 = raw.step3 as Record<string, unknown>;
    try {
      const { parsed, routing_fallbacks } = await adherenceStep4({
        requestId: jobId,
        locale: input.output?.locale ?? step1.locale,
        payloadJson: step1.payload_json,
        context: input.context,
        step2,
        step3,
      });
      return {
        ...raw,
        step4: parsed,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_intervention_planning",
            started_at: started,
            status: "ok",
            detail: { routing_fallbacks },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step4: {
          next_action: "Contact patient within 48 hours to confirm care plan.",
          intervention_recommendations: ["Outreach call", "Verify next appointment"],
          disclaimer: "Automated planning failed; use clinical judgment.",
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_intervention_planning",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
