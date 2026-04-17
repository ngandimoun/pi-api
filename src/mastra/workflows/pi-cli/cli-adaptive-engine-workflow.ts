import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

export const cliAdaptiveEngineWorkflowInputSchema = z.object({
  organization_id: z.string(),
  library_hint: z.string().optional(),
  intent_confidence: z.number().optional(),
});

const analyzeStep = createStep({
  id: "adaptive-analyze",
  inputSchema: cliAdaptiveEngineWorkflowInputSchema,
  outputSchema: z.object({
    organization_id: z.string(),
    notes: z.string(),
    severity: z.enum(["info", "warn"]),
  }),
  execute: async ({ inputData }) => ({
    organization_id: inputData.organization_id,
    notes: `Adaptive engine placeholder (library_hint=${inputData.library_hint ?? "n/a"}, confidence=${inputData.intent_confidence ?? "n/a"}). Extend with Firecrawl + LLM.`,
    severity: "info" as const,
  }),
});

export const cliAdaptiveEngineWorkflow = createWorkflow({
  id: "cli-adaptive-engine-workflow",
  inputSchema: cliAdaptiveEngineWorkflowInputSchema,
  outputSchema: z.object({
    organization_id: z.string(),
    notes: z.string(),
    severity: z.enum(["info", "warn"]),
  }),
})
  .then(analyzeStep)
  .commit();
