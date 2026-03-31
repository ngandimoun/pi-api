import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { patientRiskStep2Assessment } from "@/lib/clinical/gemini-patient-risk";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step2PatientRiskAssessment = createStep({
  id: "patient-risk-step2-risk-assessment",
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
    const step1 = raw.step1 as {
      locale?: string;
      patient_json: string;
      patient_json_for_llm: string;
    };

    try {
      const step2 = await patientRiskStep2Assessment({
        requestId: jobId,
        locale: input.output?.locale ?? step1.locale,
        patientJson: step1.patient_json_for_llm,
        context: input.context,
      });
      return {
        ...raw,
        step2,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_risk_assessment",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step2: {
          risk_level: "moderate",
          time_sensitivity: "days",
          clinical_rationale: "Automated risk assessment unavailable; defaulting to moderate.",
          risk_flags: ["assessment_degraded"],
          escalation_triggers: ["reassess_when_clinician_available"],
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_risk_assessment",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
