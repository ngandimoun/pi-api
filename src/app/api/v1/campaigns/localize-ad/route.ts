import { withApiAuth } from "@/lib/auth";
import { queueCampaignLocalization } from "@/lib/campaigns/queue-localization";

/**
 * OpenAI-compatible async endpoint for culturally localizing an existing ad image.
 *
 * This endpoint accepts exactly one source image (URL/base64/data URL) and a target culture,
 * then runs a background localization workflow that preserves the original composition.
 */
export const POST = withApiAuth(async (request) => {
  return queueCampaignLocalization(request);
});

