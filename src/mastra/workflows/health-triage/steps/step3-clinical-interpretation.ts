import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { interpretForTriage } from "@/lib/health/model-router";
import { startTimer, finishDiagnostic } from "@/mastra/workflows/health-triage/debug";
import { step3OutputSchema } from "@/mastra/workflows/health-triage/schemas";

export const step3ClinicalInterpretation = createStep({
  id: "health-triage-step3-clinical-interpretation",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const input = inputData.input.input;
    const modality = inputData.step1?.modality ?? input.modality ?? input.type;
    const locale = inputData.step1?.locale;

    try {
      const { result, fallbacks } = await interpretForTriage({
        requestId: inputData.job_id,
        locale,
        modality,
        imageUrlOrData: input.type === "image" ? input.data : undefined,
        context: inputData.input.context,
        processedSummary: inputData.step2?.processed_summary,
      });

      const step3 = step3OutputSchema.parse({
        triage_level: result.triage_level,
        confidence: result.confidence,
        narrative: result.narrative,
        findings: result.findings,
        routing_fallbacks: fallbacks,
      });

      return {
        ...inputData,
        step3,
        diagnostics: [
          ...(inputData as any).diagnostics ?? [],
          finishDiagnostic({
            step: "step3_clinical_interpretation",
            started_at: started,
            status: "ok",
            detail: { routing_fallbacks: fallbacks },
          }),
        ],
      } as any;
    } catch (error) {
      const step3 = step3OutputSchema.parse({
        triage_level: "standard",
        confidence: 0.4,
        narrative: "Interpretation unavailable. Please consult a clinician.",
        findings: [],
        routing_fallbacks: [],
      });

      return {
        ...inputData,
        step3,
        diagnostics: [
          ...(inputData as any).diagnostics ?? [],
          finishDiagnostic({
            step: "step3_clinical_interpretation",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown_error" },
          }),
        ],
      } as any;
    }
  },
});

