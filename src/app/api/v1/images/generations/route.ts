import { withApiAuth } from "@/lib/auth";
import { queueAdGeneration } from "@/lib/ads/queue-generation";

/**
 * OpenAI-compatible images generation entrypoint (async job pattern).
 */
export const POST = withApiAuth(async (request) => {
  return queueAdGeneration(request);
});

