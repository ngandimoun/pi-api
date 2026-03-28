import { withApiAuth } from "@/lib/auth";
import { queueAdGeneration } from "@/lib/ads/queue-generation";

/**
 * Dedicated alias for static ads generation (same backend as /images/generations).
 */
export const POST = withApiAuth(async (request) => {
  return queueAdGeneration(request);
});

