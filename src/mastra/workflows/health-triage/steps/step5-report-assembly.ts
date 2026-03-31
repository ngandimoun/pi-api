import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { startTimer, finishDiagnostic } from "@/mastra/workflows/health-triage/debug";
import { healthTriageWorkflowOutputSchema } from "@/mastra/workflows/health-triage/schemas";

export const step5ReportAssembly = createStep({
  id: "health-triage-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: healthTriageWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const locale = inputData.step1?.locale;

    const output = {
      triage_level: inputData.step3?.triage_level ?? "standard",
      confidence: inputData.step3?.confidence ?? 0.5,
      locale,
      findings: inputData.step3?.findings ?? [],
      segmentation_overlay_url: inputData.step2?.segmentation_overlay_url ?? null,
      seizure_detected: inputData.step2?.seizure_detected ?? null,
      treatment_plan:
        inputData.step4?.treatment_plan ??
        "Provide supportive care and refer to a clinician if symptoms worsen or red flags are present.",
      referral_recommendation: inputData.step4?.referral_recommendation,
      red_flags: inputData.step4?.red_flags ?? [],
      disclaimer:
        inputData.step4?.disclaimer ??
        "This tool provides triage support only and is not a medical diagnosis. If the patient has danger signs, seek urgent medical care.",
    };

    return healthTriageWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(inputData.diagnostics ?? []),
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});

