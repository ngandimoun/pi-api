import { getGeminiLiveModelId } from "./config";

export type LiveWsApiVersion = "v1beta" | "v1alpha";

export function buildLiveWsUrlWithApiKey(apiKey: string, apiVersion: LiveWsApiVersion = "v1beta") {
  if (!apiKey?.trim()) {
    throw new Error("Missing apiKey for Live WebSocket URL.");
  }
  const versionPath =
    apiVersion === "v1alpha"
      ? "google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained"
      : "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

  const url = new URL(`wss://generativelanguage.googleapis.com/ws/${versionPath}`);
  url.searchParams.set("key", apiKey.trim());
  return url.toString();
}

export function buildLiveWsUrlWithEphemeralToken(accessToken: string) {
  if (!accessToken?.trim()) {
    throw new Error("Missing accessToken for Live WebSocket URL.");
  }
  // Ephemeral tokens use v1alpha constrained endpoint.
  const url = new URL(
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained"
  );
  url.searchParams.set("access_token", accessToken.trim());
  return url.toString();
}

export type LiveWsSetupMessage = {
  config: Record<string, unknown>;
};

export function makeLiveWsSetupMessage(input: {
  model_id?: string;
  config: Record<string, unknown>;
}): LiveWsSetupMessage {
  const model = getGeminiLiveModelId({ model_id: input.model_id });
  return {
    config: {
      ...input.config,
      model: `models/${model}`,
    },
  };
}

export type LiveWsRealtimeInputMessage = {
  realtimeInput: Record<string, unknown>;
};

export function makeLiveWsRealtimeInputMessage(input: Record<string, unknown>): LiveWsRealtimeInputMessage {
  return {
    realtimeInput: input,
  };
}

export type LiveWsToolResponseMessage = {
  toolResponse: {
    functionResponses: unknown[];
  };
};

export function makeLiveWsToolResponseMessage(functionResponses: unknown[]): LiveWsToolResponseMessage {
  return {
    toolResponse: {
      functionResponses,
    },
  };
}

/**
 * Helper for parsing server messages. Keep it permissive; consumers should
 * handle fields they care about (serverContent, toolCall, goAway, etc).
 */
export function parseLiveWsServerMessage(json: string): unknown {
  return JSON.parse(json);
}

