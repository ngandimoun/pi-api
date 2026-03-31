import { getCampaignGeminiClient } from "@/lib/campaigns/gemini-client";
import {
  generateHealthJsonWithRetry,
  getHealthGeminiModelId,
  parseJsonObject,
} from "@/lib/health/gemini-fallback";
import { runClinicalTextJsonChain } from "@/lib/clinical/clinical-json-fallback";

const RISK_STEP2_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    risk_level: { type: "string", enum: ["critical", "high", "moderate", "low"] },
    time_sensitivity: { type: "string", enum: ["immediate", "hours", "days", "weeks"] },
    clinical_rationale: { type: "string" },
    risk_flags: { type: "array", items: { type: "string" } },
    escalation_triggers: { type: "array", items: { type: "string" } },
  },
  required: ["risk_level", "time_sensitivity", "clinical_rationale", "risk_flags", "escalation_triggers"],
} as const;

const PRIORITY_STEP3_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    priority_rank_rationale: { type: "string" },
    resource_requirements: { type: "array", items: { type: "string" } },
    differential_considerations: { type: "array", items: { type: "string" } },
  },
  required: ["priority_rank_rationale", "resource_requirements", "differential_considerations"],
} as const;

const ACTIONS_STEP4_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    next_action: { type: "string" },
    recommended_actions: { type: "array", items: { type: "string" } },
    clinical_style_summary: { type: "string" },
    disclaimer: { type: "string" },
  },
  required: ["next_action", "recommended_actions", "disclaimer"],
} as const;

async function geminiJson(params: {
  requestId: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const ai = getCampaignGeminiClient();
  const model = getHealthGeminiModelId();
  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ role: "user", parts: [{ text: [params.system, "", params.user].join("\n") }] }],
    schema: params.schema,
  });
  return parseJsonObject(text);
}

export async function patientRiskStep2Assessment(params: {
  requestId: string;
  locale?: string;
  patientJson: string;
  context?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const system = [
    "You are a clinical prioritization assistant for resource-limited settings.",
    "You do NOT diagnose. You assess relative acuity and time sensitivity for triage queues.",
    "Output JSON only matching the schema.",
  ].join("\n");
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Patient_payload (JSON): ${params.patientJson.slice(0, 100_000)}`,
    params.context ? `Facility_context (JSON): ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return geminiJson({
    requestId: params.requestId,
    system,
    user,
    schema: RISK_STEP2_SCHEMA as unknown as Record<string, unknown>,
  });
}

export async function patientRiskStep3Priority(params: {
  requestId: string;
  locale?: string;
  patientJson: string;
  context?: Record<string, unknown>;
  step2: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const system = [
    "Rank this patient relative to others in the same facility context.",
    "Explain priority rationale and resource needs. Non-diagnostic.",
    "Output JSON only matching the schema.",
  ].join("\n");
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Prior_risk_assessment (JSON): ${JSON.stringify(params.step2).slice(0, 20_000)}`,
    `Patient_payload (JSON): ${params.patientJson.slice(0, 80_000)}`,
    params.context ? `Facility_context (JSON): ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return geminiJson({
    requestId: params.requestId,
    system,
    user,
    schema: PRIORITY_STEP3_SCHEMA as unknown as Record<string, unknown>,
  });
}

export async function patientRiskStep4Actions(params: {
  requestId: string;
  locale?: string;
  patientJson: string;
  context?: Record<string, unknown>;
  step2: Record<string, unknown>;
  step3: Record<string, unknown>;
}): Promise<{ parsed: Record<string, unknown>; routing_fallbacks: string[] }> {
  const system = [
    "Produce concrete next actions for clinic staff (who to see first, what to order, when to escalate).",
    "Non-diagnostic; include safety disclaimer.",
    "Output JSON only matching the schema.",
  ].join("\n");
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Risk (JSON): ${JSON.stringify(params.step2).slice(0, 16_000)}`,
    `Priority (JSON): ${JSON.stringify(params.step3).slice(0, 16_000)}`,
    `Patient_payload (JSON): ${params.patientJson.slice(0, 60_000)}`,
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 12_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return runClinicalTextJsonChain({
    requestId: params.requestId,
    locale: params.locale,
    systemPrompt: system,
    userContent: user,
    schemaName: "PatientRiskActions",
    jsonSchema: ACTIONS_STEP4_SCHEMA as unknown as Record<string, unknown>,
  });
}
