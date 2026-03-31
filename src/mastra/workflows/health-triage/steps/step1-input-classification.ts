import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { startTimer, finishDiagnostic } from "@/mastra/workflows/health-triage/debug";
import { healthTriageWorkflowInputSchema, step1OutputSchema } from "@/mastra/workflows/health-triage/schemas";

function resolveLocale(input: {
  output?: { locale?: string } | undefined;
  context?: Record<string, unknown> | undefined;
}): string | undefined {
  const fromOutput = input.output?.locale?.trim();
  if (fromOutput) return fromOutput;
  const ctx = input.context ?? {};
  const raw = (ctx["locale"] ?? ctx["language"] ?? ctx["lang"]) as unknown;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().slice(0, 32) : undefined;
}

export const step1InputClassification = createStep({
  id: "health-triage-step1-input-classification",
  inputSchema: healthTriageWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const type = inputData.input.input.type;
    const modality = (inputData.input.input.modality ?? type).trim();
    const locale = resolveLocale({
      output: inputData.input.output,
      context: inputData.input.context,
    });

    const step1 = step1OutputSchema.parse({
      input_type: type,
      modality,
      locale,
    });

    return {
      ...inputData,
      step1,
      diagnostics: [
        ...(inputData as any).diagnostics ?? [],
        finishDiagnostic({ step: "step1_input_classification", started_at: started, status: "ok" }),
      ],
    } as any;
  },
});

