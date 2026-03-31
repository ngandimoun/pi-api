import { withApiAuth } from "@/lib/auth";
import { queueHealthTriageAnalysis } from "@/lib/health/queue-triage-analysis";

/**
 * OpenAI-compatible async endpoint for point-of-care triage analysis (image or EEG).
 */
export const POST = withApiAuth(async (request) => {
  return queueHealthTriageAnalysis(request);
});

