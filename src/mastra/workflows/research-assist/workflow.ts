import { createWorkflow } from "@mastra/core/workflows";

import {
  researchAssistWorkflowInputSchema,
  researchAssistWorkflowOutputSchema,
} from "@/mastra/workflows/research-assist/schemas";
import { step1ResearchClassification } from "@/mastra/workflows/research-assist/steps/step1-input-classification";
import { step2ResearchAnalysis } from "@/mastra/workflows/research-assist/steps/step2-data-analysis";
import { step3ResearchSynthesis } from "@/mastra/workflows/research-assist/steps/step3-synthesis";
import { step4ResearchFinalize } from "@/mastra/workflows/research-assist/steps/step4-recommendations";
import { step5ResearchAssembly } from "@/mastra/workflows/research-assist/steps/step5-report-assembly";

export const researchAssistWorkflow = createWorkflow({
  id: "research-assist-workflow",
  inputSchema: researchAssistWorkflowInputSchema,
  outputSchema: researchAssistWorkflowOutputSchema,
})
  .then(step1ResearchClassification)
  .then(step2ResearchAnalysis)
  .then(step3ResearchSynthesis)
  .then(step4ResearchFinalize)
  .then(step5ResearchAssembly)
  .commit();
