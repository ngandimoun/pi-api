import { z } from "zod";

import {
  scanAnalysisDiagnosticsStepSchema,
  scanAnalysisInputSchema,
  scanAnalysisOutputSchema,
} from "@/contracts/scan-analysis-api";

export { scanAnalysisDiagnosticsStepSchema };

export const scanAnalysisWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: scanAnalysisInputSchema,
});

export const scanAnalysisWorkflowOutputSchema = z.object({
  output: scanAnalysisOutputSchema,
  diagnostics: z.array(scanAnalysisDiagnosticsStepSchema).default([]),
});
