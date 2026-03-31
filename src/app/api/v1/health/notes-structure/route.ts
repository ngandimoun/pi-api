import { withApiAuth } from "@/lib/auth";
import { queueNotesStructure } from "@/lib/clinical/queue-notes-structure";

export const POST = withApiAuth(async (request) => queueNotesStructure(request));
