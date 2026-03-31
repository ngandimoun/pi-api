import { z } from "zod";

import {
  researchAssistDiagnosticsStepSchema,
  researchAssistInputSchema,
  researchAssistOutputSchema,
} from "@/contracts/research-assist-api";

export { researchAssistDiagnosticsStepSchema };

export const researchAssistWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: researchAssistInputSchema,
});

export const researchAssistWorkflowOutputSchema = z.object({
  output: researchAssistOutputSchema,
  diagnostics: z.array(researchAssistDiagnosticsStepSchema).default([]),
});
