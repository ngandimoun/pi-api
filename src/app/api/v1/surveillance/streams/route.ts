import { withApiAuth } from "@/lib/auth";
import { queueStreamAnalysis } from "@/lib/surveillance/queue-stream-analysis";

/**
 * OpenAI-compatible async endpoint: start a surveillance stream analysis job (perception + policies + narration).
 */
export const POST = withApiAuth(async (request) => {
  return queueStreamAnalysis(request);
});
