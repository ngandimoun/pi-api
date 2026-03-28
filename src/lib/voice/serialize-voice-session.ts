import type { VoiceSession } from "@/types/database";

export function toVoiceSessionUnixTimestamp(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(ms / 1000);
}

/** Shared shape for GET /voice/sessions/:id and POST .../complete responses. */
export function serializeVoiceSession(row: VoiceSession) {
  return {
    session_id: row.id,
    agent_id: row.agent_id,
    status: row.status,
    participant: row.participant,
    context: row.context,
    transcript: row.transcript,
    results: row.results,
    duration_seconds: row.duration_seconds,
    max_duration_seconds: row.max_duration_seconds,
    error_log: row.error_log,
    metadata: row.metadata,
    expires_at: toVoiceSessionUnixTimestamp(String(row.expires_at)),
    created_at: toVoiceSessionUnixTimestamp(String(row.created_at)),
    updated_at: toVoiceSessionUnixTimestamp(String(row.updated_at)),
  };
}
