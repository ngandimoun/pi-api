import type { NextRequest } from "next/server";

export type ProviderKeys = {
  gemini?: string;
  firecrawl?: string;
  livekit?: {
    apiKey?: string;
    apiSecret?: string;
  };
};

export function readProviderKeysFromRequest(request: NextRequest): ProviderKeys {
  const gemini = request.headers.get("x-gemini-api-key") ?? undefined;
  const firecrawl = request.headers.get("x-firecrawl-api-key") ?? undefined;
  const livekitApiKey = request.headers.get("x-livekit-api-key") ?? undefined;
  const livekitApiSecret = request.headers.get("x-livekit-api-secret") ?? undefined;

  const livekit =
    livekitApiKey || livekitApiSecret ? { apiKey: livekitApiKey, apiSecret: livekitApiSecret } : undefined;

  return {
    gemini: gemini?.trim() ? gemini.trim() : undefined,
    firecrawl: firecrawl?.trim() ? firecrawl.trim() : undefined,
    livekit: livekit
      ? {
          apiKey: livekit.apiKey?.trim() ? livekit.apiKey.trim() : undefined,
          apiSecret: livekit.apiSecret?.trim() ? livekit.apiSecret.trim() : undefined,
        }
      : undefined,
  };
}

