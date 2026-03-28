import { apiSuccess } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { GEMINI_LIVE_VOICES } from "@/lib/gemini/live/config";

/**
 * List supported Gemini Live prebuilt (Chirp 3 HD) voices for `voice.name` on agents and sessions.
 */
export const GET = withApiAuth(async (request) => {
  return apiSuccess(
    {
      object: "list",
      model: "gemini-3.1-flash-live-preview",
      data: GEMINI_LIVE_VOICES.map((v) => ({
        name: v.name,
        description: v.description,
        default: v.default,
      })),
    },
    "voice_catalog",
    request.requestId
  );
});
