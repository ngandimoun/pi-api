import { getGeminiServerApiKey, getGeminiLiveModelId } from "./config";

/**
 * Ephemeral tokens are for client-direct WebSocket connections to Live API.
 * They require v1alpha.
 */

export type CreateEphemeralTokenInput = {
  uses?: number;
  expireTimeIso?: string;
  newSessionExpireTimeIso?: string;
  /**
   * Locks the Live model and optional LiveConnectConfig (systemInstruction, modalities, etc.).
   * See `LiveConnectConstraints` in @google/genai.
   */
  liveConnectConstraints?: {
    model?: string;
    config?: Record<string, unknown>;
  };
};

export type EphemeralTokenResult = {
  /**
   * The token string to return to the client (typically `token.name` in docs).
   */
  token: string;
  raw: unknown;
};

export async function createGeminiLiveEphemeralToken(
  client: unknown,
  input: CreateEphemeralTokenInput = {}
): Promise<EphemeralTokenResult> {
  const apiKey = getGeminiServerApiKey();
  if (!apiKey) {
    throw new Error("Missing server API key for ephemeral token provisioning.");
  }

  const uses = typeof input.uses === "number" ? input.uses : 1;
  const expireTime = input.expireTimeIso;
  const newSessionExpireTime = input.newSessionExpireTimeIso;

  const constraints = input.liveConnectConstraints
    ? {
        model: getGeminiLiveModelId({ model_id: input.liveConnectConstraints.model }),
        config: input.liveConnectConstraints.config ?? {},
      }
    : undefined;

  const genai = client as {
    authTokens: {
      create: (args: unknown) => Promise<unknown>;
    };
  };

  const token = await genai.authTokens.create({
    config: {
      uses,
      ...(expireTime ? { expireTime } : {}),
      ...(newSessionExpireTime ? { newSessionExpireTime } : {}),
      ...(constraints ? { liveConnectConstraints: constraints } : {}),
      httpOptions: { apiVersion: "v1alpha" },
    },
  });

  const record = token as Record<string, unknown>;
  const name = record.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Ephemeral token provisioning succeeded but returned no token name.");
  }

  return { token: name, raw: token };
}
