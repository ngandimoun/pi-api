import { createWorkflow } from "@mastra/core/workflows";

import { campaignWorkflowInputSchema, campaignWorkflowOutputSchema } from "@/mastra/workflows/campaign-ads/schemas";
import { step1Understanding } from "@/mastra/workflows/campaign-ads/steps/step1-understanding";
import { step2Summary } from "@/mastra/workflows/campaign-ads/steps/step2-summary";
import { step3Retrieval } from "@/mastra/workflows/campaign-ads/steps/step3-retrieval";
import { step4Reasoning } from "@/mastra/workflows/campaign-ads/steps/step4-reasoning";
import { step5JsonPrompt } from "@/mastra/workflows/campaign-ads/steps/step5-json-prompt";
import { step6Generation } from "@/mastra/workflows/campaign-ads/steps/step6-generation";

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
