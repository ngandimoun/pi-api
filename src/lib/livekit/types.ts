export type LiveKitRoomName = string;
export type LiveKitIdentity = string;

export type LiveKitTokenGrants = {
  room?: string;
  roomJoin?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  hidden?: boolean;
  recorder?: boolean;
};

export type LiveKitParticipantTokenInput = {
  room: LiveKitRoomName;
  identity: LiveKitIdentity;
  name?: string;
  metadata?: string;
  attributes?: Record<string, string>;
  ttlSeconds?: number;
  grants?: LiveKitTokenGrants;
};

