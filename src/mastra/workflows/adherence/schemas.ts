import { z } from "zod";

import {
  adherenceDiagnosticsStepSchema,
  adherenceInputSchema,
  adherenceOutputSchema,
} from "@/contracts/adherence-api";

export { adherenceDiagnosticsStepSchema };

export const adherenceWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: adherenceInputSchema,
});

export const adherenceWorkflowOutputSchema = z.object({
  output: adherenceOutputSchema,
  diagnostics: z.array(adherenceDiagnosticsStepSchema).default([]),
});
