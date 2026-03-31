import { withApiAuth } from "@/lib/auth";
import { queueResearchAssist } from "@/lib/research/queue-research-assist";

export const POST = withApiAuth(async (request) => queueResearchAssist(request));
