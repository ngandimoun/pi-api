import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { generatePlan } from "@/lib/health/model-router";
import { startTimer, finishDiagnostic } from "@/mastra/workflows/health-triage/debug";
import { step4OutputSchema } from "@/mastra/workflows/health-triage/schemas";

export const step4TreatmentPlan = createStep({
  id: "health-triage-step4-treatment-plan",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const locale = inputData.step1?.locale;
    const findings = inputData.step3?.findings ?? [];
    const seizureDetected = inputData.step2?.seizure_detected ?? null;

    try {
      const plan = await generatePlan({
        requestId: inputData.job_id,
        locale,
        findings,
        seizure_detected: seizureDetected,
        context: inputData.input.context,
      });

      const { routing_fallbacks, ...planFields } = plan;
      const step4 = step4OutputSchema.parse(planFields);
      return {
        ...inputData,
        step4,
        diagnostics: [
          ...(inputData as any).diagnostics ?? [],
          finishDiagnostic({
            step: "step4_treatment_plan",
            started_at: started,
            status: "ok",
            detail: { routing_fallbacks },
          }),
        ],
      } as any;
    } catch (error) {
      const step4 = step4OutputSchema.parse({
        treatment_plan:
          "Treatment plan unavailable. Provide supportive care, monitor symptoms, and refer if danger signs are present.",
        red_flags: [],
        disclaimer:
          "This tool provides triage support only and is not a medical diagnosis. Seek urgent care if red flags are present.",
      });

      return {
        ...inputData,
        step4,
        diagnostics: [
          ...(inputData as any).diagnostics ?? [],
          finishDiagnostic({
            step: "step4_treatment_plan",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown_error" },
          }),
        ],
      } as any;
    }
  },
});

