import { getCampaignGeminiClient } from "@/lib/campaigns/gemini-client";
import {
  generateHealthJsonWithRetry,
  getHealthGeminiModelId,
  parseJsonObject,
} from "@/lib/health/gemini-fallback";

const COGNITIVE_STATE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    stress_band: { type: "string" },
    fatigue_estimate: { type: "number", minimum: 0, maximum: 1 },
    wellness_summary: { type: "string" },
    attention_proxy: { type: "number", minimum: 0, maximum: 1 },
    notes: { type: "string" },
  },
  required: ["stress_band", "fatigue_estimate", "wellness_summary"],
} as const;

const WELLNESS_SYNTHESIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    wellness_summary: { type: "string" },
    coaching_message: { type: "string" },
    recommendations: { type: "array", items: { type: "string" } },
    clinical_style_summary: { type: "string" },
    red_flags: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: ["coaching_message", "recommendations", "red_flags", "disclaimer"],
} as const;

export type CognitiveStateGemini = {
  stress_band: string;
  fatigue_estimate: number;
  wellness_summary: string;
  attention_proxy?: number;
  notes?: string;
};

export type WellnessSynthesisGemini = {
  wellness_summary?: string;
  coaching_message: string;
  recommendations: string[];
  clinical_style_summary?: string;
  red_flags: string[];
  disclaimer: string;
};

function clamp01(n: unknown, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function mergeWellnessSummary(params: {
  cognitive: string;
  synthesis?: string;
}): string {
  const syn = params.synthesis?.trim();
  if (syn && syn.length > 0) return syn;
  return params.cognitive.trim() || "Wellness summary unavailable.";
}

export async function inferCognitiveStateGemini(params: {
  requestId: string;
  locale?: string;
  eeg_decode: Record<string, unknown>;
  context?: Record<string, unknown>;
}): Promise<CognitiveStateGemini> {
  const model = getHealthGeminiModelId();
  const ai = getCampaignGeminiClient();

  const system = [
    "You infer a non-diagnostic cognitive/wellness state for wellness apps (stress bands, fatigue proxies, attention hints).",
    "You are NOT diagnosing medical or psychiatric conditions.",
    "Use cautious language; bands are approximate labels, not clinical scales.",
    "Output must be JSON only matching the schema.",
  ].join("\n");

  const userText = [
    `Request ID: ${params.requestId}`,
    params.locale ? `Locale: ${params.locale}` : "",
    `EEG_decode_envelope (JSON): ${JSON.stringify(params.eeg_decode).slice(0, 8000)}`,
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 8000)}` : "",
    "Task: Return stress_band (short label), fatigue_estimate 0-1, wellness_summary (1-3 sentences), optional attention_proxy 0-1, optional notes.",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ role: "user", parts: [{ text: [system, "", userText].join("\n") }] }],
    schema: COGNITIVE_STATE_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    throw new Error("gemini_wellness_cognitive_invalid_json");
  }

  return {
    stress_band: String(parsed.stress_band ?? "moderate").trim().slice(0, 64) || "moderate",
    fatigue_estimate: clamp01(parsed.fatigue_estimate, 0.5),
    wellness_summary: String(parsed.wellness_summary ?? "").trim().slice(0, 4000) || "State summary unavailable.",
    attention_proxy:
      typeof parsed.attention_proxy === "number" ? clamp01(parsed.attention_proxy, 0.5) : undefined,
    notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 2000) : undefined,
  };
}

export async function geminiWellnessSynthesis(params: {
  requestId: string;
  locale?: string;
  cognitive_state: Record<string, unknown>;
  eeg_decode: Record<string, unknown>;
  huatuo_narrative?: string;
  context?: Record<string, unknown>;
}): Promise<WellnessSynthesisGemini> {
  const model = getHealthGeminiModelId();
  const ai = getCampaignGeminiClient();

  const system = [
    "You produce cognitive wellness coaching and non-diagnostic summaries for apps.",
    "You are NOT providing a medical or psychiatric diagnosis.",
    "Include red_flags when escalation to professionals may be appropriate.",
    "Output must be JSON only matching the schema.",
  ].join("\n");

  const userText = [
    `Request ID: ${params.requestId}`,
    params.locale ? `Locale: ${params.locale}` : "",
    `Cognitive_state (JSON): ${JSON.stringify(params.cognitive_state).slice(0, 6000)}`,
    `EEG_decode_envelope (JSON): ${JSON.stringify(params.eeg_decode).slice(0, 4000)}`,
    params.huatuo_narrative
      ? `Vision_notes (non-diagnostic): ${params.huatuo_narrative.slice(0, 4000)}`
      : "",
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 6000)}` : "",
    "Task: coaching_message, recommendations[], optional clinical_style_summary, red_flags[], disclaimer; optional wellness_summary refinement.",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ role: "user", parts: [{ text: [system, "", userText].join("\n") }] }],
    schema: WELLNESS_SYNTHESIS_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    throw new Error("gemini_wellness_synthesis_invalid_json");
  }

  return {
    wellness_summary: typeof parsed.wellness_summary === "string" ? parsed.wellness_summary : undefined,
    coaching_message: String(parsed.coaching_message ?? "").trim(),
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
    clinical_style_summary:
      typeof parsed.clinical_style_summary === "string" ? parsed.clinical_style_summary : undefined,
    red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String) : [],
    disclaimer: String(parsed.disclaimer ?? "").trim(),
  };
}
