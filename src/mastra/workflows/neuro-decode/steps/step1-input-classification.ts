import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { neuroDecodeWorkflowInputSchema, step1NeuroOutputSchema } from "@/mastra/workflows/neuro-decode/schemas";

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

export const step1NeuroInputClassification = createStep({
  id: "neuro-decode-step1-input-classification",
  inputSchema: neuroDecodeWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const inp = inputData.input.input;
    const locale = resolveLocale({
      output: inputData.input.output,
      context: inputData.input.context,
    });

    const step1 = step1NeuroOutputSchema.parse({
      paradigm: inp.paradigm.trim(),
      locale,
      device: inp.device?.trim(),
      channels: inp.channels,
      sample_rate: inp.sample_rate,
    });

    return {
      ...inputData,
      step1,
      diagnostics: [
        ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
        finishDiagnostic({ step: "step1_input_classification", started_at: started, status: "ok" }),
      ],
    } as Record<string, unknown>;
  },
});
