import type { GoogleGenAI } from "@google/genai";

import { getGeminiLiveClient, getGeminiLiveModelId, toSdkLiveConfig, type LiveSessionConfig } from "./config";

export type LiveSdkCallbacks = {
  onopen?: () => void;
  onmessage?: (message: unknown) => void;
  onerror?: (e: { message?: string } | Error) => void;
  onclose?: (e: { reason?: string } | unknown) => void;
};

export type LiveSdkSession = {
  sendRealtimeInput: (input: Record<string, unknown>) => void;
  sendClientContent: (input: Record<string, unknown>) => void;
  sendToolResponse: (input: { functionResponses: unknown[] }) => void;
  close: () => void;
};

/**
 * Connect using the @google/genai Live SDK.
 *
 * Notes for Gemini 3.1 Flash Live Preview:
 * - AUDIO response modality only; use transcriptions for text.
 * - Tool calls are synchronous (sequential). The model waits for tool responses.
 * - A single server message may contain multiple parts; consumer must iterate all parts.
 */
export async function connectGeminiLiveSdk(options?: {
  client?: GoogleGenAI;
  session?: LiveSessionConfig;
  callbacks?: LiveSdkCallbacks;
  tools?: unknown[];
  extraConfig?: Record<string, unknown>;
}): Promise<LiveSdkSession> {
  const client = options?.client ?? getGeminiLiveClient();
  const model = getGeminiLiveModelId({ model_id: options?.session?.model_id });

  const baseConfig = toSdkLiveConfig(options?.session);
  const config: Record<string, unknown> = {
    ...baseConfig,
    ...(options?.tools ? { tools: options.tools } : {}),
    ...(options?.extraConfig ? options.extraConfig : {}),
  };

  const session = await (client as unknown as { live: { connect: (args: unknown) => Promise<LiveSdkSession> } }).live
    .connect({
      model,
      config,
      callbacks: {
        onopen: options?.callbacks?.onopen,
        onmessage: options?.callbacks?.onmessage,
        onerror: options?.callbacks?.onerror,
        onclose: options?.callbacks?.onclose,
      },
    });

  return session;
}

