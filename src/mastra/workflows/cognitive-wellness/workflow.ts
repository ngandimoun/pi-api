import { createWorkflow } from "@mastra/core/workflows";

import {
  cognitiveWellnessWorkflowInputSchema,
  cognitiveWellnessWorkflowOutputSchema,
} from "@/mastra/workflows/cognitive-wellness/schemas";
import { step1WellnessInputClassification } from "@/mastra/workflows/cognitive-wellness/steps/step1-input-classification";
import { step2WellnessEegDecode } from "@/mastra/workflows/cognitive-wellness/steps/step2-eeg-decode";
import { step3WellnessCognitiveState } from "@/mastra/workflows/cognitive-wellness/steps/step3-cognitive-state";
import { step4WellnessCoachReport } from "@/mastra/workflows/cognitive-wellness/steps/step4-coach-report";
import { step5WellnessReportAssembly } from "@/mastra/workflows/cognitive-wellness/steps/step5-report-assembly";

export const cognitiveWellnessWorkflow = createWorkflow({
  id: "cognitive-wellness-workflow",
  inputSchema: cognitiveWellnessWorkflowInputSchema,
  outputSchema: cognitiveWellnessWorkflowOutputSchema,
})
  .then(step1WellnessInputClassification)
  .then(step2WellnessEegDecode)
  .then(step3WellnessCognitiveState)
  .then(step4WellnessCoachReport)
  .then(step5WellnessReportAssembly)
  .commit();
