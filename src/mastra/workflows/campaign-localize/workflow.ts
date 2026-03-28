import { createWorkflow } from "@mastra/core/workflows";

import {
  campaignLocalizeWorkflowInputSchema,
  campaignLocalizeWorkflowOutputSchema,
} from "@/mastra/workflows/campaign-localize/schemas";
import { step1CulturalUnderstanding } from "@/mastra/workflows/campaign-localize/steps/step1-cultural-understanding";
import { step2LocalizationSummary } from "@/mastra/workflows/campaign-localize/steps/step2-localization-summary";
import { step3CulturalRetrieval } from "@/mastra/workflows/campaign-localize/steps/step3-cultural-retrieval";
import { step4CulturalReasoning } from "@/mastra/workflows/campaign-localize/steps/step4-cultural-reasoning";
import { step5LocalizedJsonPrompt } from "@/mastra/workflows/campaign-localize/steps/step5-localized-json-prompt";
import { step6LocalizedGeneration } from "@/mastra/workflows/campaign-localize/steps/step6-localized-generation";

export const campaignLocalizeWorkflow = createWorkflow({
  id: "campaign-localize-workflow",
  inputSchema: campaignLocalizeWorkflowInputSchema,
  outputSchema: campaignLocalizeWorkflowOutputSchema,
})
  .then(step1CulturalUnderstanding)
  .then(step2LocalizationSummary)
  .then(step3CulturalRetrieval)
  .then(step4CulturalReasoning)
  .then(step5LocalizedJsonPrompt)
  .then(step6LocalizedGeneration)
  .commit();

