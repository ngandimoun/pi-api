import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { patientRiskStep4Actions } from "@/lib/clinical/gemini-patient-risk";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step4PatientRiskActions = createStep({
  id: "patient-risk-step4-action-plan",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as {
      context?: Record<string, unknown>;
      output?: { locale?: string };
    };
    const step1 = raw.step1 as { locale?: string; patient_json_for_llm: string };
    const step2 = raw.step2 as Record<string, unknown>;
    const step3 = raw.step3 as Record<string, unknown>;

    try {
      const { parsed, routing_fallbacks } = await patientRiskStep4Actions({
        requestId: jobId,
        locale: input.output?.locale ?? step1.locale,
        patientJson: step1.patient_json_for_llm,
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
            step: "step4_action_plan",
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
          next_action: "Have a qualified clinician review this patient today.",
          recommended_actions: ["Manual clinical review", "Verify vitals and history"],
          disclaimer:
            "Automated action planning failed; this is a safe default. Not medical advice.",
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_action_plan",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
