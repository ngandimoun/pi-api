function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * RoomServiceClient expects an HTTP(S) base URL (e.g. https://project.livekit.cloud).
 * If LIVEKIT_URL is set with ws(s):// (common for client snippets), normalize for the server SDK.
 */
function normalizeLiveKitServerUrl(raw: string): string {
  const u = raw.trim();
  if (u.startsWith("wss://")) {
    return `https://${u.slice(6)}`;
  }
  if (u.startsWith("ws://")) {
    return `http://${u.slice(5)}`;
  }
  return u;
}

/**
 * Base URL for LiveKit **Server API** (RoomServiceClient, etc.).
 */
export function getLiveKitUrl(): string {
  const url = readEnv("LIVEKIT_URL");
  if (!url) {
    throw new Error("Missing LIVEKIT_URL");
  }
  return normalizeLiveKitServerUrl(url);
}

/**
 * WebSocket URL for browser `livekit-client` (Room.connect).
 */
export function getLiveKitClientWebSocketUrl(): string {
  const server = getLiveKitUrl();
  if (server.startsWith("https://")) {
    return `wss://${server.slice(8)}`;
  }
  if (server.startsWith("http://")) {
    return `ws://${server.slice(7)}`;
  }
  return server;
}

export function getLiveKitApiKey(): string {
  const key = readEnv("LIVEKIT_API_KEY");
  if (!key) {
    throw new Error("Missing LIVEKIT_API_KEY");
  }
  return key;
}

export function getLiveKitApiSecret(): string {
  const secret = readEnv("LIVEKIT_API_SECRET");
  if (!secret) {
    throw new Error("Missing LIVEKIT_API_SECRET");
  }
  return secret;
}

/**
 * LiveKit webhooks are signed using an API key/secret pair.
 * Keep these distinct from the Server API key/secret by default.
 */
export function getLiveKitWebhookApiKey(): string {
  const key = readEnv("LIVEKIT_WEBHOOK_API_KEY") ?? getLiveKitApiKey();
  if (!key) {
    throw new Error("Missing LIVEKIT_WEBHOOK_API_KEY (or LIVEKIT_API_KEY)");
  }
  return key;
}

export function getLiveKitWebhookApiSecret(): string {
  const secret = readEnv("LIVEKIT_WEBHOOK_API_SECRET") ?? getLiveKitApiSecret();
  if (!secret) {
    throw new Error("Missing LIVEKIT_WEBHOOK_API_SECRET (or LIVEKIT_API_SECRET)");
  }
  return secret;
}

