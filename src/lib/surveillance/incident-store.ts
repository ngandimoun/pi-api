import { EventEmitter } from "node:events";

import type { Incident } from "../../contracts/surveillance-api";
import { getServiceSupabaseClient } from "../supabase";

type ChannelKey = string;

function keyFor(orgId: string, streamId: string): ChannelKey {
  return `${orgId}:${streamId}`;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function subscribeToStream(
  orgId: string,
  streamId: string,
  handler: (incident: Incident) => void
): () => void {
  const ch = keyFor(orgId, streamId);
  const fn = (inc: Incident) => {
    handler(inc);
  };
  emitter.on(ch, fn);
  return () => {
    emitter.off(ch, fn);
  };
}

export function subscribeToOrg(orgId: string, handler: (incident: Incident) => void): () => void {
  const ch = `${orgId}:*`;
  const fn = (inc: Incident) => {
    handler(inc);
  };
  emitter.on(ch, fn);
  return () => {
    emitter.off(ch, fn);
  };
}

/**
 * Persist incident and notify SSE subscribers.
 */
export async function pushIncident(params: {
  orgId: string;
  incident: Incident;
}): Promise<void> {
  const { orgId, incident } = params;
  const supabase = getServiceSupabaseClient();
  await supabase.from("surveillance_incidents").insert({
    org_id: orgId,
    stream_id: incident.stream_id,
    payload: incident as unknown as Record<string, unknown>,
  });

  emitter.emit(keyFor(orgId, incident.stream_id), incident);
  emitter.emit(`${orgId}:*`, incident);
}
