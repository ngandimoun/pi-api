import { RoomServiceClient } from "livekit-server-sdk";

import { getLiveKitApiKey, getLiveKitApiSecret, getLiveKitUrl } from "./env";

export function getLiveKitRoomServiceClient(): RoomServiceClient {
  return new RoomServiceClient(getLiveKitUrl(), getLiveKitApiKey(), getLiveKitApiSecret());
}

/**
 * Creates a LiveKit room. Note: pinned `livekit-server-sdk` CreateOptions do not expose a max room
 * duration; cap call length is returned on the voice session API and mirrored in `metadata` JSON.
 */
export async function createLiveKitRoom(input: {
  name: string;
  emptyTimeoutSeconds?: number;
  maxParticipants?: number;
  metadata?: string;
}) {
  const client = getLiveKitRoomServiceClient();
  return client.createRoom({
    name: input.name,
    emptyTimeout: input.emptyTimeoutSeconds,
    maxParticipants: input.maxParticipants,
    metadata: input.metadata,
  });
}

export async function listLiveKitRooms(names?: string[]) {
  const client = getLiveKitRoomServiceClient();
  return client.listRooms(names && names.length > 0 ? names : undefined);
}

export async function deleteLiveKitRoom(name: string) {
  const client = getLiveKitRoomServiceClient();
  return client.deleteRoom(name);
}

export async function listLiveKitParticipants(roomName: string) {
  const client = getLiveKitRoomServiceClient();
  return client.listParticipants(roomName);
}

export async function removeLiveKitParticipant(roomName: string, identity: string) {
  const client = getLiveKitRoomServiceClient();
  return client.removeParticipant(roomName, identity);
}

export async function updateLiveKitParticipant(input: {
  roomName: string;
  identity: string;
  metadata?: string;
  name?: string;
  attributes?: Record<string, string>;
  permissions?: {
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
    hidden?: boolean;
    canUpdateMetadata?: boolean;
  };
}) {
  const client = getLiveKitRoomServiceClient();
  return client.updateParticipant(input.roomName, input.identity, {
    metadata: input.metadata,
    name: input.name,
    permission: input.permissions,
    attributes: input.attributes,
  });
}

