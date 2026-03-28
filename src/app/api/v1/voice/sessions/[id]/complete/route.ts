import { z } from "zod";

import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { voiceSessionCompleteInputSchema } from "@/contracts/voice-session-api";
import { completeVoiceSession } from "@/lib/voice/complete-session";
import { serializeVoiceSession } from "@/lib/voice/serialize-voice-session";
import type { AppRouteContext } from "@/types/api";
import type { VoiceSession } from "@/types/database";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

async function resolveRouteParams(
  params: unknown
): Promise<Record<string, string | string[]> | undefined> {
  if (!params) {
    return undefined;
  }
  if (typeof (params as Promise<unknown>).then === "function") {
    const awaited = await (params as Promise<unknown>);
    if (awaited && typeof awaited === "object") {
      return awaited as Record<string, string | string[]>;
    }
    return undefined;
  }
  if (typeof params === "object") {
    return params as Record<string, string | string[]>;
  }
  return undefined;
}

/**
 * Submit transcript and receive structured extraction results (non-live Gemini pass).
 */
export const POST = withApiAuth(async (request, context: AppRouteContext) => {
  const resolved = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolved ?? {});
  if (!parsedParams.success) {
    return apiError("invalid_session_id", "Session id must be a valid UUID.", 400, request.requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = voiceSessionCompleteInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  try {
    const { session, results, extraction_warnings: extractionWarningsRaw } = await completeVoiceSession({
      organizationId: request.organizationId,
      sessionId: parsedParams.data.id,
      body: parsed.data,
    });
    const extraction_warnings = extractionWarningsRaw ?? [];

    const s = session as VoiceSession;
    return apiSuccess(
      {
        ...serializeVoiceSession(s),
        results,
        ...(extraction_warnings.length > 0 ? { extraction_warnings } : {}),
      },
      "voice_session",
      request.requestId
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "voice_session_lookup_failed") {
      return apiError(
        "voice_session_lookup_failed",
        "Failed to load voice session.",
        500,
        request.requestId,
        "api_error"
      );
    }
    if (msg === "voice_session_not_found") {
      return apiError("voice_session_not_found", "Voice session not found.", 404, request.requestId);
    }
    if (msg === "voice_session_not_active") {
      return apiError(
        "voice_session_not_active",
        "Session is not active; only active sessions can be completed.",
        409,
        request.requestId
      );
    }
    if (msg === "voice_agent_lookup_failed") {
      return apiError(
        "voice_agent_lookup_failed",
        "Failed to load voice agent.",
        500,
        request.requestId,
        "api_error"
      );
    }
    if (msg === "voice_agent_not_found") {
      return apiError("voice_agent_not_found", "Voice agent not found.", 404, request.requestId);
    }
    if (msg === "voice_result_extraction_failed") {
      return apiError(
        "voice_result_extraction_failed",
        "Failed to extract structured results from transcript.",
        502,
        request.requestId,
        "api_error"
      );
    }
    if (msg === "voice_session_update_failed") {
      return apiError(
        "voice_session_update_failed",
        "Failed to persist voice session results.",
        500,
        request.requestId,
        "api_error"
      );
    }
    return apiError(
      "voice_session_complete_failed",
      "Failed to complete voice session.",
      500,
      request.requestId,
      "api_error"
    );
  }
});
