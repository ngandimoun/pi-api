import { AccessToken } from "livekit-server-sdk";

import { getLiveKitApiKey, getLiveKitApiSecret } from "./env";
import type { LiveKitParticipantTokenInput } from "./types";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export async function createLiveKitParticipantToken(input: LiveKitParticipantTokenInput): Promise<string> {
  const apiKey = getLiveKitApiKey();
  const apiSecret = getLiveKitApiSecret();

  if (!input.room?.trim()) throw new Error("LiveKit token requires room");
  if (!input.identity?.trim()) throw new Error("LiveKit token requires identity");

  const ttlSeconds = input.ttlSeconds ?? 60 * 10;
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 60 * 60) {
    throw new Error("ttlSeconds must be 1..3600");
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: input.identity,
    name: input.name,
    metadata: input.metadata,
    attributes: input.attributes,
    ttl: ttlSeconds,
  });

  const grants = {
    room: input.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    ...(input.grants ?? {}),
  };
  at.addGrant(grants as unknown as Record<string, unknown>);

  const token = await at.toJwt();
  if (!token) {
    throw new Error("Failed to mint LiveKit token");
  }
  return token;
}

export async function createLiveKitUserToken(
  input: Omit<LiveKitParticipantTokenInput, "grants">
): Promise<string> {
  return createLiveKitParticipantToken({
    ...input,
    grants: {
      hidden: false,
    },
  });
}

export async function createLiveKitAgentToken(
  input: Omit<LiveKitParticipantTokenInput, "grants">
): Promise<string> {
  // Default to hidden agent participant. Explicitly override if you want the agent visible.
  return createLiveKitParticipantToken({
    ...input,
    grants: {
      hidden: true,
    },
  });
}

export function createDefaultRoomName(prefix = "pi_room"): string {
  return `${prefix}_${nowSeconds()}_${crypto.randomUUID()}`;
}

