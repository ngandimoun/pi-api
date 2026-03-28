import { GoogleGenAI } from "@google/genai";

const LIVE_MODEL_ID = "gemini-3.1-flash-live-preview" as const;

/**
 * Gemini 3.1 Flash Live Preview — Chirp 3 HD prebuilt voices (name + short description).
 * Default TTS voice when omitted is typically **Puck** (Gemini default).
 */
export const GEMINI_LIVE_VOICES = [
  { name: "Zephyr", description: "Bright", default: false },
  { name: "Puck", description: "Upbeat", default: true },
  { name: "Charon", description: "Informative", default: false },
  { name: "Kore", description: "Firm", default: false },
  { name: "Fenrir", description: "Excitable", default: false },
  { name: "Leda", description: "Youthful", default: false },
  { name: "Orus", description: "Firm", default: false },
  { name: "Aoede", description: "Breezy", default: false },
  { name: "Callirrhoe", description: "Easy-going", default: false },
  { name: "Autonoe", description: "Bright", default: false },
  { name: "Enceladus", description: "Breathy", default: false },
  { name: "Iapetus", description: "Clear", default: false },
  { name: "Umbriel", description: "Easy-going", default: false },
  { name: "Algieba", description: "Smooth", default: false },
  { name: "Despina", description: "Smooth", default: false },
  { name: "Erinome", description: "Clear", default: false },
  { name: "Algenib", description: "Gravelly", default: false },
  { name: "Rasalgethi", description: "Informative", default: false },
  { name: "Laomedeia", description: "Upbeat", default: false },
  { name: "Achernar", description: "Soft", default: false },
  { name: "Alnilam", description: "Firm", default: false },
  { name: "Schedar", description: "Even", default: false },
  { name: "Gacrux", description: "Mature", default: false },
  { name: "Pulcherrima", description: "Forward", default: false },
  { name: "Achird", description: "Friendly", default: false },
  { name: "Zubenelgenubi", description: "Casual", default: false },
  { name: "Vindemiatrix", description: "Gentle", default: false },
  { name: "Sadachbia", description: "Lively", default: false },
  { name: "Sadaltager", description: "Knowledgeable", default: false },
  { name: "Sulafat", description: "Warm", default: false },
] as const;

export const GEMINI_LIVE_VOICE_NAMES = GEMINI_LIVE_VOICES.map((v) => v.name);

export type GeminiLiveVoiceName = (typeof GEMINI_LIVE_VOICES)[number]["name"];

export function isGeminiLiveVoiceName(name: string): name is GeminiLiveVoiceName {
  return (GEMINI_LIVE_VOICE_NAMES as readonly string[]).includes(name);
}

export function getDefaultGeminiLiveVoiceName(): GeminiLiveVoiceName {
  const d = GEMINI_LIVE_VOICES.find((v) => v.default);
  return (d ?? GEMINI_LIVE_VOICES[1]).name;
}

function readEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name]?.trim();
  if (value) return value;
  const fb = fallback?.trim();
  return fb ? fb : undefined;
}

export type LiveThinkingLevel = "minimal" | "low" | "medium" | "high";

export type LiveVoiceName = GeminiLiveVoiceName | string;

export type LiveSessionConfig = {
  /**
   * Strict policy: we only allow Gemini 3.1 Flash Live Preview for voice agents.
   * If you provide a model_id, it must match exactly.
   */
  model_id?: string;
  /**
   * Live API native audio models only support AUDIO response modality.
   * Text output should be enabled via transcription fields.
   */
  response_modalities?: ["AUDIO"];
  /**
   * Enable model audio output transcription (text).
   */
  output_audio_transcription?: boolean;
  /**
   * Enable user audio input transcription (text).
   */
  input_audio_transcription?: boolean;
  /**
   * Voice name (prebuilt Chirp 3 HD voices; see GEMINI_LIVE_VOICES).
   */
  voice_name?: LiveVoiceName;
  /**
   * Speech synthesis language (e.g. en-US, fr-FR). Passed to Live `speechConfig.languageCode` when set.
   */
  language_code?: string;
  /**
   * Thinking config for 3.1 live models.
   */
  thinking_level?: LiveThinkingLevel;
  include_thoughts?: boolean;
};

export function getGeminiServerApiKey(): string {
  const apiKey = readEnv("GEMINI_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  if (!apiKey) {
    throw new Error("Missing GEMINI_KEY (or GOOGLE_GENERATIVE_AI_API_KEY).");
  }
  return apiKey;
}

export function getGeminiLiveModelId(input?: { model_id?: string }): typeof LIVE_MODEL_ID {
  const requested =
    input?.model_id?.trim() ??
    readEnv("GOOGLE_LIVE_MODEL")?.trim() ??
    LIVE_MODEL_ID;

  if (requested !== LIVE_MODEL_ID) {
    throw new Error(
      `Unsupported Live model '${requested}'. Policy: only '${LIVE_MODEL_ID}' is allowed for voice agents.`
    );
  }
  return LIVE_MODEL_ID;
}

export function getGeminiLiveClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiServerApiKey() });
}

export function toSdkLiveConfig(config: LiveSessionConfig | undefined) {
  const thinkingLevel = config?.thinking_level ?? ("minimal" as LiveThinkingLevel);
  const includeThoughts = config?.include_thoughts === true;
  const voiceName = config?.voice_name?.trim();
  const languageCode = config?.language_code?.trim();

  // Keep the shape tolerant because @google/genai Live config types evolve.
  const sdkConfig: Record<string, unknown> = {
    responseModalities: ["AUDIO"],
  };

  if (config?.output_audio_transcription) {
    sdkConfig.outputAudioTranscription = {};
  }
  if (config?.input_audio_transcription) {
    sdkConfig.inputAudioTranscription = {};
  }
  if (voiceName || languageCode) {
    sdkConfig.speechConfig = {
      ...(voiceName
        ? {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          }
        : {}),
      ...(languageCode ? { languageCode } : {}),
    };
  }

  sdkConfig.thinkingConfig = {
    thinkingLevel,
    ...(includeThoughts ? { includeThoughts: true } : {}),
  };

  return sdkConfig;
}

