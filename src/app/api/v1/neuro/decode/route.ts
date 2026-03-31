import { withApiAuth } from "@/lib/auth";
import { queueNeuroDecode } from "@/lib/neuro/queue-neuro-decode";

/**
 * OpenAI-compatible async endpoint for BCI / EEG intent decode (Neural-Mobility & ALS Assist).
 */
export const POST = withApiAuth(async (request) => {
  return queueNeuroDecode(request);
});
