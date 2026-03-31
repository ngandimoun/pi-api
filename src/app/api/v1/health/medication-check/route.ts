import { withApiAuth } from "@/lib/auth";
import { queueMedicationCheck } from "@/lib/clinical/queue-medication-check";

export const POST = withApiAuth(async (request) => queueMedicationCheck(request));
