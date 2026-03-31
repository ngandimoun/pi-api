import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { patientRiskStep3Priority } from "@/lib/clinical/gemini-patient-risk";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step3PatientRiskPriority = createStep({
  id: "patient-risk-step3-priority-ranking",
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

    try {
      const step3 = await patientRiskStep3Priority({
        requestId: jobId,
        locale: input.output?.locale ?? step1.locale,
        patientJson: step1.patient_json_for_llm,
        context: input.context,
        step2,
      });
      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_priority_ranking",
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
          priority_rank_rationale: "Priority ranking defaulted due to processing error.",
          resource_requirements: [],
          differential_considerations: [],
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_priority_ranking",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
