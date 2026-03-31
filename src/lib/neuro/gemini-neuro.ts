import type { MetabciEegResult } from "@/lib/health/metabci-client";
import { getCampaignGeminiClient } from "@/lib/campaigns/gemini-client";
import {
  generateHealthJsonWithRetry,
  getHealthGeminiModelId,
  parseJsonObject,
} from "@/lib/health/gemini-fallback";

const DECODE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    seizure_detected: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    detail: {
      type: "object",
      additionalProperties: true,
      properties: {
        source: { type: "string" },
        suggested_signal_class: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  required: ["seizure_detected", "confidence"],
} as const;

const INTERPRET_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decoded_intent: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    paradigm_detected: { type: "string" },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          intent: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["intent", "confidence"],
      },
    },
    red_flags: { type: "array", items: { type: "string" } },
  },
  required: ["decoded_intent", "confidence", "paradigm_detected", "alternatives", "red_flags"],
} as const;

const PREDICT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    predicted_text: { type: "string" },
    session_context: { type: "string" },
  },
  required: ["predicted_text"],
} as const;

function dataFingerprint(data: string): string {
  const s = data.slice(0, 200);
  return `${data.length}_chars_${s}`;
}

/**
 * Best-effort EEG path when MetaBCI sidecar is unavailable.
 * Does not process raw waveforms; uses metadata + context only. Same envelope as MetaBCI HTTP.
 */
export async function geminiDecodeEeg(params: {
  requestId: string;
  paradigm: string;
  data: string;
  device?: string;
  channels?: number;
  sample_rate?: number;
  context?: Record<string, unknown>;
}): Promise<MetabciEegResult> {
  const model = getHealthGeminiModelId();
  const ai = getCampaignGeminiClient();

  const prompt = [
    "You assist with BCI / EEG orchestration for accessibility (ALS, locked-in, motor disability).",
    "You do NOT receive raw voltage samples—only payload metadata and context.",
    "Infer a conservative best-effort signal summary for routing; never claim clinical diagnosis.",
    "If uncertain, set seizure_detected=false and low confidence.",
    "Output JSON only matching the schema.",
    "",
    `Request ID: ${params.requestId}`,
    `Paradigm: ${params.paradigm}`,
    params.device ? `Device: ${params.device}` : "",
    params.channels != null ? `Channels: ${params.channels}` : "",
    params.sample_rate != null ? `Sample rate (Hz): ${params.sample_rate}` : "",
    `Payload fingerprint (not raw EEG): ${dataFingerprint(params.data)}`,
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ text: prompt }],
    schema: DECODE_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    throw new Error("gemini_neuro_decode_invalid_json");
  }

  const seizure = Boolean(parsed.seizure_detected);
  const conf =
    typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : 0.35;

  const detail =
    parsed.detail && typeof parsed.detail === "object" && !Array.isArray(parsed.detail)
      ? { ...(parsed.detail as Record<string, unknown>), source: "gemini_fallback" }
      : { source: "gemini_fallback" };

  return {
    seizure_detected: seizure,
    confidence: conf,
    detail,
  };
}

export type GeminiInterpretResult = {
  decoded_intent: string;
  confidence: number;
  paradigm_detected: string;
  alternatives: Array<{ intent: string; confidence: number }>;
  red_flags: string[];
};

export async function geminiInterpretIntent(params: {
  requestId: string;
  paradigm: string;
  decode: MetabciEegResult;
  context?: Record<string, unknown>;
  locale?: string;
}): Promise<GeminiInterpretResult> {
  const model = getHealthGeminiModelId();
  const ai = getCampaignGeminiClient();

  const prompt = [
    "Map EEG decode metadata to a user-facing intent for accessibility software (wheelchair, smart home, spelling UI).",
    "Use paradigm to choose intent vocabulary (motor_imagery: move_left/move_right/rest; p300: letter or option id; ssvep: target frequency id).",
    "If paradigm is unknown, use generic intents like focus/select/cancel.",
    "Never claim medical diagnosis. Output JSON only matching the schema.",
    "",
    `Request ID: ${params.requestId}`,
    params.locale ? `Locale: ${params.locale}` : "",
    `Paradigm hint: ${params.paradigm}`,
    `Decode envelope (JSON): ${JSON.stringify(params.decode).slice(0, 8000)}`,
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ text: prompt }],
    schema: INTERPRET_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    throw new Error("gemini_neuro_interpret_invalid_json");
  }

  const alternatives: Array<{ intent: string; confidence: number }> = [];
  if (Array.isArray(parsed.alternatives)) {
    for (const a of parsed.alternatives) {
      if (!a || typeof a !== "object") continue;
      const o = a as Record<string, unknown>;
      const intent = typeof o.intent === "string" ? o.intent.trim() : "";
      const c =
        typeof o.confidence === "number" && o.confidence >= 0 && o.confidence <= 1 ? o.confidence : 0;
      if (intent) alternatives.push({ intent, confidence: c });
    }
  }

  return {
    decoded_intent: String(parsed.decoded_intent ?? "unknown").trim() || "unknown",
    confidence:
      typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : 0.5,
    paradigm_detected: String(parsed.paradigm_detected ?? params.paradigm).trim() || params.paradigm,
    alternatives,
    red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String) : [],
  };
}

export type GeminiPredictResult = {
  predicted_text: string;
  session_context?: string;
};

export async function geminiPredictText(params: {
  requestId: string;
  decoded_intent: string;
  paradigm: string;
  context?: Record<string, unknown>;
  locale?: string;
}): Promise<GeminiPredictResult> {
  const model = getHealthGeminiModelId();
  const ai = getCampaignGeminiClient();

  const prompt = [
    "You accelerate communication for users spelling or selecting via BCI.",
    "Given the latest decoded intent and optional session_history in context, produce a short predicted continuation (phrase or sentence).",
    "If intent is a single letter (P300), append likely next letters only when context strongly suggests a word—otherwise keep prediction short.",
    "Output JSON only matching the schema. session_context should briefly summarize state for the next request (optional).",
    "",
    `Request ID: ${params.requestId}`,
    params.locale ? `Locale: ${params.locale}` : "",
    `Paradigm: ${params.paradigm}`,
    `Decoded intent: ${params.decoded_intent}`,
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ text: prompt }],
    schema: PREDICT_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    throw new Error("gemini_neuro_predict_invalid_json");
  }

  return {
    predicted_text: String(parsed.predicted_text ?? "").trim() || params.decoded_intent,
    session_context:
      typeof parsed.session_context === "string" && parsed.session_context.trim()
        ? parsed.session_context.trim().slice(0, 8000)
        : undefined,
  };
}
