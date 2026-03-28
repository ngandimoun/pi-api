import { createDefaultRoomName, createLiveKitUserToken } from "@/lib/livekit/tokens";
import { createLiveKitRoom, deleteLiveKitRoom } from "@/lib/livekit/room-service";
import { getLiveKitClientWebSocketUrl } from "@/lib/livekit/env";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { createGeminiLiveEphemeralToken } from "@/lib/gemini/live/ephemeral";
import { buildLiveWsUrlWithEphemeralToken } from "@/lib/gemini/live/ws";
import { getGeminiLiveClient, toSdkLiveConfig, type LiveSessionConfig } from "@/lib/gemini/live/config";
import type { VoiceAgent } from "@/types/database";

export type StartVoiceSessionResult = {
  sessionId: string;
  agentId: string;
  expiresAtUnix: number;
  connection: {
    livekit: { url: string; token: string };
    gemini_live: { url: string; token: string };
  };
  /** Same instruction locked into the ephemeral token; useful if the client must send an initial setup message. */
  system_instruction: string;
  /** When set, clients should end the call within this many seconds from session start (see also room metadata). */
  max_duration_seconds: number | null;
};

function coerceMaxDurationSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  if (n < 60 || n > 1800) return null;
  return n;
}

export async function startVoiceSession(input: {
  organizationId: string;
  agentId: string;
  participant: { identity: string; name?: string };
  context?: Record<string, unknown>;
  ttlSeconds: number;
  /** Per-session override; when omitted, uses agent `behaviors.max_duration_seconds` when present. */
  maxDurationSeconds?: number;
  /** When set, overrides agent `voice_config` for this session only (name + optional language_code). */
  voice?: { name?: string; language_code?: string };
}): Promise<StartVoiceSessionResult> {
  const supabase = getServiceSupabaseClient();
  const { data: agentRow, error: agentError } = await supabase
    .from("voice_agents")
    .select("*")
    .eq("id", input.agentId)
    .eq("org_id", input.organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (agentError) {
    console.warn("[voice.sessions.start] agent_lookup_failed", {
      agentId: input.agentId,
      orgId: input.organizationId,
      message: agentError.message,
    });
    throw new Error("voice_agent_lookup_failed");
  }
  if (!agentRow) {
    throw new Error("voice_agent_not_found");
  }

  const agent = agentRow as VoiceAgent;
  const system_instruction = agent.system_instruction?.trim() ?? "";
  if (!system_instruction) {
    throw new Error("voice_agent_invalid_config");
  }

  const behaviors = agent.behaviors as { max_duration_seconds?: unknown } | null;
  const resolvedMaxDurationSeconds =
    input.maxDurationSeconds !== undefined
      ? input.maxDurationSeconds
      : coerceMaxDurationSeconds(behaviors?.max_duration_seconds);

  const ttl = input.ttlSeconds;
  if (resolvedMaxDurationSeconds !== null && ttl < resolvedMaxDurationSeconds) {
    throw new Error("voice_session_ttl_too_short");
  }

  const agentVoice = (agent.voice_config ?? {}) as { name?: string; language_code?: string };
  const sessionVoice = input.voice;
  const resolvedName =
    sessionVoice?.name?.trim() || agentVoice.name?.trim() || undefined;
  const resolvedLanguage =
    sessionVoice?.language_code?.trim() || agentVoice.language_code?.trim() || undefined;
  const liveSessionConfig: LiveSessionConfig = {
    output_audio_transcription: true,
    input_audio_transcription: true,
    voice_name: resolvedName,
    language_code: resolvedLanguage,
    thinking_level: "low",
  };

  const sdkLiveConfig = toSdkLiveConfig(liveSessionConfig);
  const liveConnectConfig: Record<string, unknown> = {
    ...sdkLiveConfig,
    systemInstruction: system_instruction,
  };

  const sessionId = crypto.randomUUID();
  const roomName = createDefaultRoomName("pi_voice");

  const metadata = JSON.stringify({
    pi_voice_session_id: sessionId,
    org_id: input.organizationId,
    agent_id: input.agentId,
    ...(resolvedMaxDurationSeconds !== null ? { max_duration_seconds: resolvedMaxDurationSeconds } : {}),
  });

  await createLiveKitRoom({
    name: roomName,
    emptyTimeoutSeconds: ttl,
    maxParticipants: 4,
    metadata,
  });

  const expiresAtIso = new Date(Date.now() + ttl * 1000).toISOString();

  const { error: insertError } = await supabase.from("voice_sessions").insert({
    id: sessionId,
    org_id: input.organizationId,
    agent_id: input.agentId,
    status: "active",
    participant: input.participant as unknown as Record<string, unknown>,
    context: (input.context ?? {}) as Record<string, unknown>,
    livekit_room_name: roomName,
    expires_at: expiresAtIso,
    max_duration_seconds: resolvedMaxDurationSeconds,
    metadata: {},
  });

  if (insertError) {
    console.warn("[voice.sessions.start] session_insert_failed", {
      sessionId,
      roomName,
      message: insertError.message,
    });
    try {
      await deleteLiveKitRoom(roomName);
    } catch (cleanupErr) {
      console.warn("[voice.sessions.start] room_cleanup_failed", {
        roomName,
        message: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    }
    throw new Error("voice_session_create_failed");
  }

  const tokenTtl = Math.min(ttl, 3600);
  let livekitToken: string;
  try {
    livekitToken = await createLiveKitUserToken({
      room: roomName,
      identity: input.participant.identity,
      name: input.participant.name,
      ttlSeconds: tokenTtl,
    });
  } catch (e) {
    await rollbackSessionAndRoom(supabase, sessionId, input.organizationId, roomName);
    throw e;
  }

  const livekitUrl = getLiveKitClientWebSocketUrl();

  let geminiToken: string;
  let geminiWsUrl: string;
  try {
    const genai = getGeminiLiveClient();
    const ephemeral = await createGeminiLiveEphemeralToken(genai, {
      uses: 1,
      expireTimeIso: expiresAtIso,
      newSessionExpireTimeIso: expiresAtIso,
      liveConnectConstraints: {
        config: liveConnectConfig,
      },
    });
    geminiToken = ephemeral.token;
    geminiWsUrl = buildLiveWsUrlWithEphemeralToken(geminiToken);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[voice.sessions.start] gemini_ephemeral_failed", { sessionId, message });
    await rollbackSessionAndRoom(supabase, sessionId, input.organizationId, roomName);
    throw new Error("voice_gemini_ephemeral_failed");
  }

  console.info("[voice.sessions.start] ok", {
    sessionId,
    agentId: input.agentId,
    orgId: input.organizationId,
    roomName,
  });

  return {
    sessionId,
    agentId: input.agentId,
    expiresAtUnix: Math.floor(Date.parse(expiresAtIso) / 1000),
    connection: {
      livekit: { url: livekitUrl, token: livekitToken },
      gemini_live: { url: geminiWsUrl, token: geminiToken },
    },
    system_instruction,
    max_duration_seconds: resolvedMaxDurationSeconds,
  };
}

async function rollbackSessionAndRoom(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  sessionId: string,
  organizationId: string,
  roomName: string
) {
  const { error: delSessionErr } = await supabase
    .from("voice_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("org_id", organizationId);
  if (delSessionErr) {
    console.warn("[voice.sessions.start] rollback_session_failed", {
      sessionId,
      message: delSessionErr.message,
    });
  }
  try {
    await deleteLiveKitRoom(roomName);
  } catch (cleanupErr) {
    console.warn("[voice.sessions.start] rollback_room_failed", {
      roomName,
      message: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
    });
  }
}
