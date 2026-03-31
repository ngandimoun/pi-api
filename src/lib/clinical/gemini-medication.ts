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
    interactions: { type: "array", items: { type: "object", additionalProperties: true } },
    contraindications: { type: "array", items: { type: "object", additionalProperties: true } },
    dosing_alerts: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  required: ["interactions", "contraindications", "dosing_alerts"],
} as const;

const S3 = {
  type: "object",
  additionalProperties: false,
  properties: {
    adherence_risk: { type: "string", enum: ["high", "moderate", "low"] },
    adherence_barriers: { type: "array", items: { type: "object", additionalProperties: true } },
    optimization_suggestions: { type: "array", items: { type: "object", additionalProperties: true } },
    missing_medications: { type: "array", items: { type: "object", additionalProperties: true } },
    monitoring_plan: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  required: [
    "adherence_risk",
    "adherence_barriers",
    "optimization_suggestions",
    "missing_medications",
    "monitoring_plan",
  ],
} as const;

const S4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    next_action: { type: "string" },
    patient_education: { type: "array", items: { type: "string" } },
    risk_flags: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: ["next_action", "patient_education", "risk_flags", "disclaimer"],
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

export async function medicationStep2(params: {
  requestId: string;
  locale?: string;
  payloadJson: string;
  context?: Record<string, unknown>;
}) {
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Medication_review (JSON): ${params.payloadJson.slice(0, 180_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return gj(
    "Detect drug-drug interactions, contraindications with conditions, and dosing issues. JSON only.",
    user,
    S2 as unknown as Record<string, unknown>,
    params.requestId
  );
}

export async function medicationStep3(params: {
  requestId: string;
  locale?: string;
  payloadJson: string;
  context?: Record<string, unknown>;
  step2: Record<string, unknown>;
}) {
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Safety (JSON): ${JSON.stringify(params.step2).slice(0, 40_000)}`,
    `Medication_review (JSON): ${params.payloadJson.slice(0, 120_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return gj(
    "Assess adherence risk, barriers, optimization and guideline gaps. JSON only.",
    user,
    S3 as unknown as Record<string, unknown>,
    params.requestId
  );
}

export async function medicationStep4(params: {
  requestId: string;
  locale?: string;
  payloadJson: string;
  context?: Record<string, unknown>;
  step2: Record<string, unknown>;
  step3: Record<string, unknown>;
}) {
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Safety (JSON): ${JSON.stringify(params.step2).slice(0, 30_000)}`,
    `Adherence_opt (JSON): ${JSON.stringify(params.step3).slice(0, 30_000)}`,
    `Medication_review (JSON): ${params.payloadJson.slice(0, 80_000)}`,
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return runClinicalTextJsonChain({
    requestId: params.requestId,
    locale: params.locale,
    systemPrompt:
      "Produce next action for pharmacist/clinician and plain-language patient education bullets. JSON only.",
    userContent: user,
    schemaName: "MedicationFinalize",
    jsonSchema: S4 as unknown as Record<string, unknown>,
  });
}
