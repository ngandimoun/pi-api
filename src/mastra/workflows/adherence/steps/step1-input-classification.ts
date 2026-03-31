import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { adherenceWorkflowInputSchema } from "@/mastra/workflows/adherence/schemas";

function resolveLocale(input: {
  output?: { locale?: string } | undefined;
  context?: Record<string, unknown> | undefined;
}): string | undefined {
  const fromOutput = input.output?.locale?.trim();
  if (fromOutput) return fromOutput;
  const ctx = input.context ?? {};
  const raw = (ctx["locale"] ?? ctx["language"]) as unknown;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().slice(0, 32) : undefined;
}

export const step1AdherenceClassification = createStep({
  id: "adherence-step1-input-classification",
  inputSchema: adherenceWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const base = inputData.input.input.data;
    let payloadJson = base;
    if (inputData.input.input.notes?.trim()) {
      try {
        const t = JSON.parse(base) as Record<string, unknown>;
        payloadJson = JSON.stringify({
          ...t,
          clinical_notes: inputData.input.input.notes.trim().slice(0, 60_000),
        });
      } catch {
        payloadJson = JSON.stringify({
          timeline: base.slice(0, 100_000),
          clinical_notes: inputData.input.input.notes.trim().slice(0, 60_000),
        });
      }
    }
    const locale = resolveLocale({
      output: inputData.input.output,
      context: inputData.input.context,
    });
    return {
      ...inputData,
      step1: { locale, payload_json: payloadJson },
      diagnostics: [
        ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
        finishDiagnostic({ step: "step1_input_classification", started_at: started, status: "ok" }),
      ],
    } as Record<string, unknown>;
  },
});
