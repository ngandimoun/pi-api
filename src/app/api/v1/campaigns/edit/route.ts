import { withApiAuth } from "@/lib/auth";
import { queueCampaignEdit } from "@/lib/campaigns/queue-edit";

/**
 * OpenAI-compatible async endpoint for editing a previously generated
 * static campaign ad image (Gemini native image+text editing).
 */
export const POST = withApiAuth(async (request) => {
  return queueCampaignEdit(request);
});

