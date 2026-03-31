import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { buildDecisionUserPayload } from "@/lib/clinical/gemini-decision-support";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { decisionSupportWorkflowInputSchema } from "@/mastra/workflows/decision-support/schemas";

export const step1DecisionClassification = createStep({
  id: "decision-support-step1-input-classification",
  inputSchema: decisionSupportWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const inp = inputData.input;
    const locale = inp.output?.locale?.trim() ?? (inp.context?.locale as string | undefined);
    const userBlock = buildDecisionUserPayload({
      dataJson: inp.input.data,
      structured: inp.input.structured_data,
      guidelines: inp.input.guidelines,
      context: inp.context,
      locale: typeof locale === "string" ? locale : undefined,
    });
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
