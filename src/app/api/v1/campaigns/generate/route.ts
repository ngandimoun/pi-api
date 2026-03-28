import { withApiAuth } from "@/lib/auth";
import { queueCampaignGeneration } from "@/lib/campaigns/queue-generation";

/**
 * OpenAI-compatible async endpoint for high-quality static campaign ad generation.
 */
export const POST = withApiAuth(async (request) => {
  return queueCampaignGeneration(request);
});
