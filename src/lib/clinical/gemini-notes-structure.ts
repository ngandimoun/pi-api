import { getCampaignGeminiClient } from "@/lib/campaigns/gemini-client";
import {
  generateHealthJsonWithRetry,
  getHealthGeminiModelId,
  parseJsonObject,
} from "@/lib/health/gemini-fallback";
import { runClinicalTextJsonChain } from "@/lib/clinical/clinical-json-fallback";

const STEP2_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    symptoms: { type: "array", items: { type: "object", additionalProperties: true } },
    conditions: { type: "array", items: { type: "object", additionalProperties: true } },
    medications: { type: "array", items: { type: "object", additionalProperties: true } },
    risk_factors: { type: "array", items: { type: "object", additionalProperties: true } },
    procedures: { type: "array", items: { type: "object", additionalProperties: true } },
    allergies: { type: "array", items: { type: "object", additionalProperties: true } },
    vitals_extracted: { type: "object", additionalProperties: true },
  },
  required: [
    "symptoms",
    "conditions",
    "medications",
    "risk_factors",
    "procedures",
    "allergies",
    "vitals_extracted",
  ],
} as const;

const STEP3_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    timeline: { type: "array", items: { type: "object", additionalProperties: true } },
    coding_suggestions: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  required: ["timeline", "coding_suggestions"],
} as const;

const STEP4_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    disclaimer: { type: "string" },
    action_items: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "disclaimer", "action_items"],
} as const;

async function geminiJson(system: string, user: string, schema: Record<string, unknown>, requestId: string) {
  const ai = getCampaignGeminiClient();
  const model = getHealthGeminiModelId();
  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ role: "user", parts: [{ text: [system, "", user].join("\n") }] }],
    schema,
  });
  return parseJsonObject(text);
}

export async function notesExtractStep2(params: {
  requestId: string;
  locale?: string;
  notes: string;
  formatHint?: string;
  context?: Record<string, unknown>;
}) {
  const system =
    "Extract structured clinical entities from notes. Do not invent facts. JSON only.";
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    params.formatHint ? `Format hint: ${params.formatHint}` : "",
    `Notes:\n${params.notes.slice(0, 62_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return geminiJson(system, user, STEP2_SCHEMA as unknown as Record<string, unknown>, params.requestId);
}

export async function notesTimelineStep3(params: {
  requestId: string;
  locale?: string;
  notes: string;
  step2: Record<string, unknown>;
  context?: Record<string, unknown>;
}) {
  const system = "Build chronological timeline and ICD/CPT-style coding hints from notes. JSON only.";
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Entities (JSON): ${JSON.stringify(params.step2).slice(0, 40_000)}`,
    `Notes:\n${params.notes.slice(0, 40_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return geminiJson(system, user, STEP3_SCHEMA as unknown as Record<string, unknown>, params.requestId);
}

export async function notesFinalizeStep4(params: {
  requestId: string;
  locale?: string;
  notes: string;
  step2: Record<string, unknown>;
  step3: Record<string, unknown>;
  context?: Record<string, unknown>;
}) {
  const system =
    "Write concise summary, regulatory disclaimer, and concrete action items for care team. JSON only.";
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Entities: ${JSON.stringify(params.step2).slice(0, 30_000)}`,
    `Timeline/coding: ${JSON.stringify(params.step3).slice(0, 20_000)}`,
    `Notes excerpt:\n${params.notes.slice(0, 20_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 6000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return runClinicalTextJsonChain({
    requestId: params.requestId,
    locale: params.locale,
    systemPrompt: system,
    userContent: user,
    schemaName: "NotesFinalize",
    jsonSchema: STEP4_SCHEMA as unknown as Record<string, unknown>,
  });
}
