import { WebhookReceiver } from "livekit-server-sdk";

import { getLiveKitWebhookApiKey, getLiveKitWebhookApiSecret } from "./env";

export type LiveKitWebhookReceiveInput = {
  rawBody: string | Buffer;
  authorizationHeader: string | null;
};

export async function verifyAndParseLiveKitWebhook(input: LiveKitWebhookReceiveInput): Promise<unknown> {
  const auth = input.authorizationHeader?.trim();
  if (!auth) {
    throw new Error("Missing LiveKit webhook Authorization header");
  }

  const receiver = new WebhookReceiver(getLiveKitWebhookApiKey(), getLiveKitWebhookApiSecret());
  const raw = typeof input.rawBody === "string" ? input.rawBody : input.rawBody.toString("utf8");
  return receiver.receive(raw, auth);
}

