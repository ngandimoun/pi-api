import { createWorkflow } from "@mastra/core/workflows";

import {
  neuroDecodeWorkflowInputSchema,
  neuroDecodeWorkflowOutputSchema,
} from "@/mastra/workflows/neuro-decode/schemas";
import { step1NeuroInputClassification } from "@/mastra/workflows/neuro-decode/steps/step1-input-classification";
import { step2NeuroEegDecode } from "@/mastra/workflows/neuro-decode/steps/step2-eeg-decode";
import { step3NeuroIntentInterpretation } from "@/mastra/workflows/neuro-decode/steps/step3-intent-interpretation";
import { step4NeuroPredictiveOutput } from "@/mastra/workflows/neuro-decode/steps/step4-predictive-output";
import { step5NeuroReportAssembly } from "@/mastra/workflows/neuro-decode/steps/step5-report-assembly";

export const neuroDecodeWorkflow = createWorkflow({
  id: "neuro-decode-workflow",
  inputSchema: neuroDecodeWorkflowInputSchema,
  outputSchema: neuroDecodeWorkflowOutputSchema,
})
  .then(step1NeuroInputClassification)
  .then(step2NeuroEegDecode)
  .then(step3NeuroIntentInterpretation)
  .then(step4NeuroPredictiveOutput)
  .then(step5NeuroReportAssembly)
  .commit();
