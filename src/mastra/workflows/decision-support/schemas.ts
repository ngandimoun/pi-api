import { z } from "zod";

import {
  decisionSupportDiagnosticsStepSchema,
  decisionSupportInputSchema,
  decisionSupportOutputSchema,
} from "@/contracts/decision-support-api";

export { decisionSupportDiagnosticsStepSchema };

export const decisionSupportWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: decisionSupportInputSchema,
});

export const decisionSupportWorkflowOutputSchema = z.object({
  output: decisionSupportOutputSchema,
  diagnostics: z.array(decisionSupportDiagnosticsStepSchema).default([]),
});
