import { createWorkflow } from "@mastra/core/workflows";

import {
  scanAnalysisWorkflowInputSchema,
  scanAnalysisWorkflowOutputSchema,
} from "@/mastra/workflows/scan-analysis/schemas";
import { step1ScanClassification } from "@/mastra/workflows/scan-analysis/steps/step1-input-classification";
import { step2ScanMonai } from "@/mastra/workflows/scan-analysis/steps/step2-image-processing";
import { step3ScanInterpret } from "@/mastra/workflows/scan-analysis/steps/step3-finding-synthesis";
import { step4ScanExplanation } from "@/mastra/workflows/scan-analysis/steps/step4-explanation-generation";
import { step5ScanAssembly } from "@/mastra/workflows/scan-analysis/steps/step5-report-assembly";

export const scanAnalysisWorkflow = createWorkflow({
  id: "scan-analysis-workflow",
  inputSchema: scanAnalysisWorkflowInputSchema,
  outputSchema: scanAnalysisWorkflowOutputSchema,
})
  .then(step1ScanClassification)
  .then(step2ScanMonai)
  .then(step3ScanInterpret)
  .then(step4ScanExplanation)
  .then(step5ScanAssembly)
  .commit();
