import { withApiAuth } from "@/lib/auth";
import { queueCampaignGeneration } from "@/lib/campaigns/queue-generation";

/**
 * OpenAI-style image alias for the campaign ads pipeline.
 * This route maps to the same backend as /api/v1/campaigns/generate.
 */
export const POST = withApiAuth(async (request) => {
  return queueCampaignGeneration(request);
});
