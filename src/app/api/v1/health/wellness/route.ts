import { withApiAuth } from "@/lib/auth";
import { queueCognitiveWellness } from "@/lib/wellness/queue-cognitive-wellness";

/**
 * OpenAI-compatible async endpoint for cognitive health & mental wellness (EEG + optional vision).
 */
export const POST = withApiAuth(async (request) => {
  return queueCognitiveWellness(request);
});
