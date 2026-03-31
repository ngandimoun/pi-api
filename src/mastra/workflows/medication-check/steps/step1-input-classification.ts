import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { medicationCheckWorkflowInputSchema } from "@/mastra/workflows/medication-check/schemas";

export const step1MedicationClassification = createStep({
  id: "medication-check-step1-input-classification",
  inputSchema: medicationCheckWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const locale =
      inputData.input.output?.locale?.trim() ??
      (typeof inputData.input.context?.locale === "string" ? inputData.input.context.locale : undefined);
    return {
      ...inputData,
      step1: { locale, payload_json: inputData.input.input.data },
      diagnostics: [
        ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
        finishDiagnostic({ step: "step1_input_classification", started_at: started, status: "ok" }),
      ],
    } as Record<string, unknown>;
  },
});
