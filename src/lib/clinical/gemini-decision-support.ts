import { getCampaignGeminiClient } from "@/lib/campaigns/gemini-client";
import {
  generateHealthJsonWithRetry,
  getHealthGeminiModelId,
  parseJsonObject,
} from "@/lib/health/gemini-fallback";
import { runClinicalTextJsonChain } from "@/lib/clinical/clinical-json-fallback";

const S2 = {
  type: "object",
  additionalProperties: false,
  properties: {
    evidence_references: { type: "array", items: { type: "object", additionalProperties: true } },
    key_facts: { type: "array", items: { type: "string" } },
  },
  required: ["evidence_references", "key_facts"],
} as const;

const S3 = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommended_action: { type: "string" },
    reasoning: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    alternatives: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  required: ["recommended_action", "reasoning", "confidence", "alternatives"],
} as const;

const S4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    contraindications: { type: "array", items: { type: "string" } },
    monitoring_plan: { type: "array", items: { type: "string" } },
    escalation_criteria: { type: "array", items: { type: "string" } },
    patient_communication: { type: "string" },
    risk_flags: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: [
    "contraindications",
    "monitoring_plan",
    "escalation_criteria",
    "patient_communication",
    "risk_flags",
    "disclaimer",
  ],
} as const;

async function gj(system: string, user: string, schema: Record<string, unknown>, requestId: string) {
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

export function buildDecisionUserPayload(params: {
  dataJson: string;
  structured?: Record<string, unknown>;
  guidelines?: string;
  context?: Record<string, unknown>;
  locale?: string;
}) {
  return [
    params.locale ? `Locale: ${params.locale}` : "",
    `Clinical_situation (JSON): ${params.dataJson.slice(0, 100_000)}`,
    params.structured ? `Structured_prior (JSON): ${JSON.stringify(params.structured).slice(0, 40_000)}` : "",
    params.guidelines ? `Guidelines_excerpt:\n${params.guidelines.slice(0, 50_000)}` : "",
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function decisionEvidenceStep2(params: {
  requestId: string;
  userBlock: string;
}) {
  return gj(
    "Synthesize evidence-linked facts from the case. Non-diagnostic decision support. JSON only.",
    params.userBlock,
    S2 as unknown as Record<string, unknown>,
    params.requestId
  );
}

export async function decisionCoreStep3(params: {
  requestId: string;
  userBlock: string;
  step2: Record<string, unknown>;
}) {
  const user = `${params.userBlock}\n\nPrior_evidence (JSON): ${JSON.stringify(params.step2).slice(0, 30_000)}`;
  return gj(
    "Recommend a primary clinical management action with reasoning and alternatives. JSON only.",
    user,
    S3 as unknown as Record<string, unknown>,
    params.requestId
  );
}

export async function decisionSafetyStep4(params: {
  requestId: string;
  locale?: string;
  userBlock: string;
  step2: Record<string, unknown>;
  step3: Record<string, unknown>;
}) {
  const user = [
    params.userBlock.slice(0, 40_000),
    `Evidence (JSON): ${JSON.stringify(params.step2).slice(0, 20_000)}`,
    `Decision (JSON): ${JSON.stringify(params.step3).slice(0, 20_000)}`,
  ].join("\n");
  return runClinicalTextJsonChain({
    requestId: params.requestId,
    locale: params.locale,
    systemPrompt:
      "Add safety layer: contraindications, monitoring, escalation, plain-language patient communication, disclaimer. JSON only.",
    userContent: user,
    schemaName: "DecisionSafety",
    jsonSchema: S4 as unknown as Record<string, unknown>,
  });
}
