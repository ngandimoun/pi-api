import { getServiceSupabaseClient } from "@/lib/supabase";
import type { Json } from "@/types/database";

type LiveKitRoomEvent = {
  event?: string;
  room?: {
    name?: string;
    metadata?: string;
  };
};

export type LiveKitVoiceWebhookResult =
  | { ok: true; handled: boolean }
  | { ok: false; handled: boolean; error: string };

/**
 * Records LiveKit room lifecycle on the session row (metadata only).
 * Final status and structured results are set via POST /voice/sessions/:id/complete.
 */
export async function handleLiveKitVoiceWebhookEvent(event: unknown): Promise<LiveKitVoiceWebhookResult> {
  const evt = event as LiveKitRoomEvent;
  const name = evt.room?.name?.trim();
  if (!name) {
    return { ok: true, handled: false };
  }

  if (evt.event !== "room_finished") {
    return { ok: true, handled: false };
  }

  const supabase = getServiceSupabaseClient();

  const { data: sessionRow, error } = await supabase
    .from("voice_sessions")
    .select("id, status")
    .eq("livekit_room_name", name)
    .maybeSingle();

  if (error) {
    console.warn("[voice.webhook] session_lookup_failed", { roomName: name, message: error.message });
    return { ok: false, handled: false, error: error.message };
  }
  if (!sessionRow) {
    return { ok: true, handled: false };
  }

  const metaPatch: Record<string, unknown> = {
    livekit_event: evt.event,
    room_metadata: evt.room?.metadata ?? null,
    livekit_room_finished_at: new Date().toISOString(),
  };

  const { data: existing, error: metaLoadError } = await supabase
    .from("voice_sessions")
    .select("metadata")
    .eq("id", sessionRow.id)
    .maybeSingle();

  if (metaLoadError) {
    console.warn("[voice.webhook] metadata_load_failed", {
      sessionId: sessionRow.id,
      message: metaLoadError.message,
    });
    return { ok: false, handled: true, error: metaLoadError.message };
  }

  const prior = (existing?.metadata ?? {}) as Record<string, unknown>;
  const merged: Json = { ...prior, ...metaPatch } as Json;

  const { error: updateError } = await supabase
    .from("voice_sessions")
    .update({
      metadata: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionRow.id);

  if (updateError) {
    console.warn("[voice.webhook] metadata_update_failed", {
      sessionId: sessionRow.id,
      message: updateError.message,
    });
    return { ok: false, handled: true, error: updateError.message };
  }

  console.info("[voice.webhook] room_finished_metadata_ok", { sessionId: sessionRow.id, roomName: name });
  return { ok: true, handled: true };
}
