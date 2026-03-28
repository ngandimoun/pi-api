import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const uppercaseStep = createStep({
  id: "uppercase",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    formatted: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { formatted: inputData.message.toUpperCase() };
  },
});

export const uppercaseWorkflow = createWorkflow({
  id: "uppercase-workflow",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    formatted: z.string(),
  }),
})
  .then(uppercaseStep)
  .commit();

