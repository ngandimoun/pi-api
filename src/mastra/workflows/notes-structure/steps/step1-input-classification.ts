import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { notesStructureWorkflowInputSchema } from "@/mastra/workflows/notes-structure/schemas";

function resolveLocale(input: {
  output?: { locale?: string };
  context?: Record<string, unknown>;
}): string | undefined {
  const o = input.output?.locale?.trim();
  if (o) return o;
  const ctx = input.context ?? {};
  const raw = (ctx["locale"] ?? ctx["language"]) as unknown;
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 32) : undefined;
}

export const step1NotesClassification = createStep({
  id: "notes-structure-step1-input-classification",
  inputSchema: notesStructureWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    return {
      ...inputData,
      step1: {
        locale: resolveLocale({
          output: inputData.input.output,
          context: inputData.input.context,
        }),
        notes: inputData.input.input.data,
        format_hint: inputData.input.input.format_hint,
      },
      diagnostics: [
        ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
        finishDiagnostic({ step: "step1_input_classification", started_at: started, status: "ok" }),
      ],
    } as Record<string, unknown>;
  },
});
