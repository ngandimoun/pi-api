import { createWorkflow } from "@mastra/core/workflows";

import { campaignWorkflowInputSchema, campaignWorkflowOutputSchema } from "./schemas";
import { step1Understanding } from "./steps/step1-understanding";
import { step2Summary } from "./steps/step2-summary";
import { step3Retrieval } from "./steps/step3-retrieval";
import { step4Reasoning } from "./steps/step4-reasoning";
import { step5JsonPrompt } from "./steps/step5-json-prompt";
import { step6Generation } from "./steps/step6-generation";

export const campaignAdsWorkflow = createWorkflow({
  id: "campaign-ads-workflow",
  inputSchema: campaignWorkflowInputSchema,
  outputSchema: campaignWorkflowOutputSchema,
})
  .then(step1Understanding)
  .then(step2Summary)
  .then(step3Retrieval)
  .then(step4Reasoning)
  .then(step5JsonPrompt)
  .then(step6Generation)
  .commit();
