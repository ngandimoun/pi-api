import { z } from "zod";

import {
  patientRiskDiagnosticsStepSchema,
  patientRiskInputSchema,
  patientRiskOutputSchema,
} from "@/contracts/patient-risk-api";

export { patientRiskDiagnosticsStepSchema };

export const patientRiskWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: patientRiskInputSchema,
});

export const patientRiskWorkflowOutputSchema = z.object({
  output: patientRiskOutputSchema,
  diagnostics: z.array(patientRiskDiagnosticsStepSchema).default([]),
});
