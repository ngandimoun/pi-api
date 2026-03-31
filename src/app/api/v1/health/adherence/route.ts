import { withApiAuth } from "@/lib/auth";
import { queueAdherence } from "@/lib/clinical/queue-adherence";

export const POST = withApiAuth(async (request) => queueAdherence(request));
