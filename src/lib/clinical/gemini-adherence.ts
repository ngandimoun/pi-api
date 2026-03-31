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
    missed_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          description: { type: "string" },
          date: { type: "string" },
          severity: { type: "string" },
        },
        required: ["type", "description"],
      },
    },
    engagement_score: { type: "number", minimum: 0, maximum: 1 },
    barriers_detected: { type: "array", items: { type: "string" } },
  },
  required: ["missed_items", "engagement_score", "barriers_detected"],
} as const;

const STEP3_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    adherence_risk: { type: "string", enum: ["high", "moderate", "low"] },
    predicted_dropoff_window: { type: "string" },
    escalation_triggers: { type: "array", items: { type: "string" } },
    risk_flags: { type: "array", items: { type: "string" } },
  },
  required: ["adherence_risk", "predicted_dropoff_window", "escalation_triggers", "risk_flags"],
} as const;

const STEP4_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    next_action: { type: "string" },
    intervention_recommendations: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: ["next_action", "intervention_recommendations", "disclaimer"],
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

export async function adherenceStep2(params: {
  requestId: string;
  locale?: string;
  payloadJson: string;
  context?: Record<string, unknown>;
}) {
  const system =
    "Detect missed visits, medication gaps, and engagement patterns from timeline JSON. Non-diagnostic. JSON only.";
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Timeline (JSON): ${params.payloadJson.slice(0, 180_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return geminiJson(system, user, STEP2_SCHEMA as unknown as Record<string, unknown>, params.requestId);
}

export async function adherenceStep3(params: {
  requestId: string;
  locale?: string;
  payloadJson: string;
  context?: Record<string, unknown>;
  step2: Record<string, unknown>;
}) {
  const system =
    "Predict non-adherence / drop-off risk from patterns. Output actionable risk tier and time window. JSON only.";
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Prior_analysis (JSON): ${JSON.stringify(params.step2).slice(0, 30_000)}`,
    `Timeline (JSON): ${params.payloadJson.slice(0, 120_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return geminiJson(system, user, STEP3_SCHEMA as unknown as Record<string, unknown>, params.requestId);
}

export async function adherenceStep4(params: {
  requestId: string;
  locale?: string;
  payloadJson: string;
  context?: Record<string, unknown>;
  step2: Record<string, unknown>;
  step3: Record<string, unknown>;
}) {
  const system =
    "Produce specific follow-up actions (e.g. call patient today). Non-diagnostic. JSON only.";
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Patterns (JSON): ${JSON.stringify(params.step2).slice(0, 24_000)}`,
    `Risk (JSON): ${JSON.stringify(params.step3).slice(0, 16_000)}`,
    `Timeline (JSON): ${params.payloadJson.slice(0, 80_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return runClinicalTextJsonChain({
    requestId: params.requestId,
    locale: params.locale,
    systemPrompt: system,
    userContent: user,
    schemaName: "AdherenceInterventions",
    jsonSchema: STEP4_SCHEMA as unknown as Record<string, unknown>,
  });
}
