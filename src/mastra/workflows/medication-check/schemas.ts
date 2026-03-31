import { z } from "zod";

import {
  medicationCheckDiagnosticsStepSchema,
  medicationCheckInputSchema,
  medicationCheckOutputSchema,
} from "@/contracts/medication-check-api";

export { medicationCheckDiagnosticsStepSchema };

export const medicationCheckWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: medicationCheckInputSchema,
});

export const medicationCheckWorkflowOutputSchema = z.object({
  output: medicationCheckOutputSchema,
  diagnostics: z.array(medicationCheckDiagnosticsStepSchema).default([]),
});
