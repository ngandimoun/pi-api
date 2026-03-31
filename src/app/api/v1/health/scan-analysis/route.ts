import { withApiAuth } from "@/lib/auth";
import { queueScanAnalysis } from "@/lib/imaging/queue-scan-analysis";

export const POST = withApiAuth(async (request) => queueScanAnalysis(request));
