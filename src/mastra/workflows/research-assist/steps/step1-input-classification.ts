import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { researchAssistWorkflowInputSchema } from "@/mastra/workflows/research-assist/schemas";

export const step1ResearchClassification = createStep({
  id: "research-assist-step1-input-classification",
  inputSchema: researchAssistWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const locale =
      inputData.input.output?.locale?.trim() ??
      (typeof inputData.input.context?.locale === "string" ? inputData.input.context.locale : undefined);
    let datasetNote = "";
    if (inputData.input.input.dataset?.trim()) {
      const d = inputData.input.input.dataset.trim();
      datasetNote = `\nDataset_attachment (truncated): ${d.slice(0, 25_000)}`;
    }
    let core: Record<string, unknown> = {};
    try {
      core = JSON.parse(inputData.input.input.data) as Record<string, unknown>;
    } catch {
      core = { raw_query: inputData.input.input.data.slice(0, 50_000) };
    }
    const userBlock = [
      typeof locale === "string" ? `Locale: ${locale}` : "",
      `Research_payload (JSON): ${JSON.stringify(core).slice(0, 80_000)}`,
      datasetNote,
      inputData.input.context
        ? `Context: ${JSON.stringify(inputData.input.context).slice(0, 12_000)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      ...inputData,
      step1: { locale: typeof locale === "string" ? locale : undefined, user_block: userBlock },
      diagnostics: [
        ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
        finishDiagnostic({ step: "step1_input_classification", started_at: started, status: "ok" }),
      ],
    } as Record<string, unknown>;
  },
});
