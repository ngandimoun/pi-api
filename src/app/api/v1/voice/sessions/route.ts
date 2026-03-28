import { apiError, apiSuccessEnvelope, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { voiceSessionCreateInputSchema } from "@/contracts/voice-session-api";
import { startVoiceSession } from "@/lib/voice/start-session";

/**
 * Start a voice session: LiveKit room + user token, and Gemini Live ephemeral WebSocket (client-direct).
 */
export const POST = withApiAuth(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = voiceSessionCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  try {
    const result = await startVoiceSession({
      organizationId: request.organizationId,
      agentId: parsed.data.agent_id,
      participant: parsed.data.participant,
      context: parsed.data.context,
      ttlSeconds: parsed.data.ttl_seconds,
      maxDurationSeconds: parsed.data.max_duration_seconds,
      voice: parsed.data.voice,
    });

    return apiSuccessEnvelope({
      requestId: request.requestId,
      object: "voice_session",
      status: "active",
      httpStatus: 201,
      data: {
        session_id: result.sessionId,
        agent_id: result.agentId,
        connection: result.connection,
        system_instruction: result.system_instruction,
        expires_at: result.expiresAtUnix,
        max_duration_seconds: result.max_duration_seconds,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "voice_agent_not_found") {
      return apiError("voice_agent_not_found", "Voice agent not found.", 404, request.requestId);
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
    if (msg === "voice_agent_invalid_config") {
      return apiError(
        "voice_agent_invalid_config",
        "Voice agent is missing system instructions.",
        500,
        request.requestId,
        "api_error"
      );
    }
    if (msg === "voice_session_create_failed") {
      return apiError(
        "voice_session_create_failed",
        "Failed to persist voice session.",
        500,
        request.requestId,
        "api_error"
      );
    }
    if (msg === "voice_gemini_ephemeral_failed") {
      return apiError(
        "voice_gemini_ephemeral_failed",
        "Failed to provision Gemini Live session token.",
        502,
        request.requestId,
        "api_error"
      );
    }
    if (msg === "voice_session_ttl_too_short") {
      return apiError(
        "voice_session_ttl_too_short",
        "ttl_seconds must be greater than or equal to the effective max_duration_seconds (session override or agent default).",
        400,
        request.requestId,
        "invalid_request_error"
      );
    }
    return apiError(
      "voice_session_start_failed",
      "Failed to start voice session.",
      500,
      request.requestId,
      "api_error"
    );
  }
});
