import { withApiAuth } from "@/lib/auth";
import { queuePatientRisk } from "@/lib/clinical/queue-patient-risk";

/** Async patient risk & priority queueing (OpenAI-style 202 + job_id). */
export const POST = withApiAuth(async (request) => {
  return queuePatientRisk(request);
});
