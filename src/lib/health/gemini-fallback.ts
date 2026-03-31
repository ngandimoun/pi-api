import type { ContentListUnion, GoogleGenAI } from "@google/genai";

import type { HealthTriageFinding } from "./types";
import { getCampaignGeminiClient } from "../campaigns/gemini-client";

/** When `HEALTH_GEMINI_MODEL` points at an id the API does not expose yet, retry once with this model. */
const GEMINI_TEXT_FALLBACK_MODEL = "gemini-2.0-flash" as const;

function isModelNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("NOT_FOUND") ||
    msg.includes("not found") ||
    msg.includes('"code":404') ||
    msg.includes("code\":404")
  );
}

/** Shared JSON `generateContent` helper (health triage + neuro decode). */
export async function generateHealthJsonWithRetry(params: {
  ai: GoogleGenAI;
  primaryModel: string;
  contents: ContentListUnion;
  schema: Record<string, unknown>;
}): Promise<{ text: string; modelUsed: string }> {
  const config = {
    responseMimeType: "application/json" as const,
    responseJsonSchema: params.schema,
    temperature: 0.2,
  };

  const run = async (model: string) => {
    const response = await params.ai.models.generateContent({
      model,
      contents: params.contents,
      config,
    });
    const text =
      response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    return { text, modelUsed: model };
  };

  try {
    return await run(params.primaryModel);
  } catch (e) {
    if (!isModelNotFoundError(e) || params.primaryModel === GEMINI_TEXT_FALLBACK_MODEL) {
      throw e;
    }
    return await run(GEMINI_TEXT_FALLBACK_MODEL);
  }
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed) as Record<string, unknown>;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }
  throw new Error("No JSON object found in model output.");
}

/**
 * Text `generateContent` model for health triage fallback.
 * Prefer `HEALTH_GEMINI_MODEL`, then shared Google defaults; last resort `gemini-2.0-flash`
 * (widely available). Newer ids like `gemini-3.1-flash` may not exist on all API versions—set env explicitly.
 */
export function getHealthGeminiModelId(): string {
  const explicit = process.env.HEALTH_GEMINI_MODEL?.trim();
  if (explicit) return explicit;
  const shared =
    process.env.GOOGLE_DEFAULT_MODEL?.trim() ||
    process.env.GOOGLE_CAMPAIGN_ORCHESTRATOR_MODEL?.trim() ||
    process.env.GOOGLE_ADS_ORCHESTRATOR_MODEL?.trim();
  if (shared) return shared;
  return "gemini-2.0-flash";
}

const INTERPRET_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    triage_level: { type: "string", enum: ["critical", "urgent", "standard", "low"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    narrative: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "array", items: { type: "string" } },
        },
        required: ["title", "summary"],
      },
    },
  },
  required: ["triage_level", "confidence", "narrative", "findings"],
} as const;

const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    treatment_plan: { type: "string" },
    referral_recommendation: { type: "string" },
    red_flags: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: ["treatment_plan", "red_flags", "disclaimer"],
} as const;

async function loadImageForGemini(
  imageUrlOrData: string
): Promise<{ mimeType: string; base64: string }> {
  if (imageUrlOrData.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(imageUrlOrData);
    if (match) {
      return { mimeType: match[1], base64: match[2] };
    }
    throw new Error("gemini_invalid_image_data_url");
  }
  if (imageUrlOrData.startsWith("http://") || imageUrlOrData.startsWith("https://")) {
    const res = await fetch(imageUrlOrData);
    if (!res.ok) {
      throw new Error(`gemini_image_fetch_failed: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    return { mimeType, base64: buf.toString("base64") };
  }
  throw new Error("gemini_unsupported_image_format");
}

const TRIAGE_LEVELS = new Set(["critical", "urgent", "standard", "low"]);

function normalizeFindings(raw: unknown): HealthTriageFinding[] {
  if (!Array.isArray(raw)) return [];
  const out: HealthTriageFinding[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const summary = typeof o.summary === "string" ? o.summary.trim() : "";
    if (!title || !summary) continue;
    const f: HealthTriageFinding = { title, summary };
    if (typeof o.confidence === "number" && o.confidence >= 0 && o.confidence <= 1) {
      f.confidence = o.confidence;
    }
    if (Array.isArray(o.evidence)) {
      f.evidence = o.evidence.map(String).filter(Boolean);
    }
    out.push(f);
  }
  return out;
}

/**
 * Gemini Flash fallback when HuatuoGPT and MedGemma interpretation are unavailable.
 * Same output shape as `medgemmaInterpretFallback` / Huatuo interpretation.
 */
export async function geminiInterpretForTriage(params: {
  requestId: string;
  locale?: string;
  modality: string;
  imageUrlOrData?: string;
  context?: Record<string, unknown>;
  processedSummary?: string;
}): Promise<{
  findings: HealthTriageFinding[];
  triage_level: "critical" | "urgent" | "standard" | "low";
  confidence: number;
  narrative: string;
  used: { provider: "gemini"; endpoint: string };
}> {
  const model = getHealthGeminiModelId();
  const ai = getCampaignGeminiClient();

  const system = [
    "You are a point-of-care triage assistant for low-resource clinics.",
    "Return triage interpretation with uncertainty and referral guidance.",
    "Do not claim a definitive diagnosis; note differentials and red flags.",
    "Output must be JSON only matching the schema.",
  ].join("\n");

  const userText = [
    `Request ID: ${params.requestId}`,
    `Modality: ${params.modality}`,
    params.locale ? `Locale: ${params.locale}` : "",
    params.processedSummary ? `Processing summary: ${params.processedSummary}` : "",
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 8000)}` : "",
    params.imageUrlOrData
      ? "Task: Interpret the attached image for triage."
      : "Task: Interpret the clinical context for triage (no image).",
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: [system, "", userText].join("\n") },
  ];

  if (params.imageUrlOrData) {
    const { mimeType, base64 } = await loadImageForGemini(params.imageUrlOrData);
    parts.push({
      inlineData: {
        mimeType,
        data: base64,
      },
    });
  }

  const { text, modelUsed } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ role: "user", parts }],
    schema: INTERPRET_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    throw new Error("gemini_invalid_json_output");
  }

  const triageRaw = parsed.triage_level;
  const triage_level = TRIAGE_LEVELS.has(String(triageRaw))
    ? (String(triageRaw) as "critical" | "urgent" | "standard" | "low")
    : "standard";

  const confidence =
    typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : 0.5;

  const narrative = String(parsed.narrative ?? "").trim() || "Triage interpretation completed.";
  const findings = normalizeFindings(parsed.findings);

  return {
    triage_level,
    confidence,
    narrative,
    findings,
    used: { provider: "gemini", endpoint: `google-genai:${modelUsed}` },
  };
}

/**
 * Gemini Flash fallback when MedGemma treatment plan generation is unavailable.
 */
export async function geminiGenerateTreatmentPlan(params: {
  requestId: string;
  locale?: string;
  findings: HealthTriageFinding[];
  seizure_detected?: boolean | null;
  context?: Record<string, unknown>;
}): Promise<{
  treatment_plan: string;
  referral_recommendation?: string;
  red_flags: string[];
  disclaimer: string;
  used: { provider: "gemini"; endpoint: string };
}> {
  const model = getHealthGeminiModelId();
  const ai = getCampaignGeminiClient();

  const system = [
    "You are a point-of-care triage assistant for low-resource clinics.",
    "You MUST be culturally appropriate and practical for remote communities.",
    "You MUST include safety caveats and when to refer/escalate.",
    "Do not present output as a definitive diagnosis.",
  ].join("\n");

  const userBody = [
    `Request ID: ${params.requestId}`,
    params.locale ? `Locale: ${params.locale}` : "",
    params.seizure_detected !== undefined && params.seizure_detected !== null
      ? `EEG seizure_detected: ${params.seizure_detected ? "true" : "false"}`
      : "",
    `Findings (JSON): ${JSON.stringify(params.findings).slice(0, 8000)}`,
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 8000)}` : "",
    "Task: Produce (1) a simple treatment/management plan, (2) referral recommendation, (3) red flags list, (4) a short disclaimer.",
    "Output must be JSON only matching the schema.",
  ]
    .filter(Boolean)
    .join("\n");

  const { text, modelUsed } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ text: [system, "", userBody].join("\n") }],
    schema: PLAN_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    throw new Error("gemini_invalid_json_output");
  }

  return {
    treatment_plan: String(parsed.treatment_plan ?? ""),
    referral_recommendation:
      typeof parsed.referral_recommendation === "string" ? parsed.referral_recommendation : undefined,
    red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String) : [],
    disclaimer: String(parsed.disclaimer ?? ""),
    used: { provider: "gemini", endpoint: `google-genai:${modelUsed}` },
  };
}
