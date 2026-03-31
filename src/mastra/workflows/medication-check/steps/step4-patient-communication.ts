import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { medicationStep4 } from "@/lib/clinical/gemini-medication";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step4MedicationFinalize = createStep({
  id: "medication-check-step4-patient-communication",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const s1 = raw.step1 as { locale?: string; payload_json: string };
    const s2 = raw.step2 as Record<string, unknown>;
    const s3 = raw.step3 as Record<string, unknown>;
    try {
      const { parsed, routing_fallbacks } = await medicationStep4({
        requestId: jobId,
        locale: input.output?.locale ?? s1.locale,
        payloadJson: s1.payload_json,
        context: input.context,
        step2: s2,
        step3: s3,
      });
      return {
        ...raw,
        step4: parsed,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_patient_communication",
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
          next_action: "Pharmacist or prescriber medication reconciliation recommended.",
          patient_education: ["Bring all medications to your next visit."],
          risk_flags: ["med_review_degraded"],
          disclaimer: "Automated medication review failed partially.",
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_patient_communication",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
