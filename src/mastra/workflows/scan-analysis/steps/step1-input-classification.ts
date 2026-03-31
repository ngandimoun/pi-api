import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { scanAnalysisWorkflowInputSchema } from "@/mastra/workflows/scan-analysis/schemas";

function resolveImageUrl(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:")) return t;
  return `data:image/jpeg;base64,${t}`;
}

export const step1ScanClassification = createStep({
  id: "scan-analysis-step1-input-classification",
  inputSchema: scanAnalysisWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const locale =
      inputData.input.output?.locale?.trim() ??
      (typeof inputData.input.context?.locale === "string" ? inputData.input.context.locale : undefined);
    const resolved = resolveImageUrl(inputData.input.input.data);
    return {
      ...inputData,
      step1: {
        locale: typeof locale === "string" ? locale : undefined,
        resolved_image_url: resolved,
        modality: inputData.input.input.modality.trim(),
        clinical_question: inputData.input.input.clinical_question?.trim(),
      },
      diagnostics: [
        ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
        finishDiagnostic({ step: "step1_input_classification", started_at: started, status: "ok" }),
      ],
    } as Record<string, unknown>;
  },
});
