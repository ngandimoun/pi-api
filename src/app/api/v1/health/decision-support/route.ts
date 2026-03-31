import { withApiAuth } from "@/lib/auth";
import { queueDecisionSupport } from "@/lib/clinical/queue-decision-support";

export const POST = withApiAuth(async (request) => queueDecisionSupport(request));
