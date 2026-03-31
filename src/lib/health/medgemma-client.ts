import type { HealthTriageFinding } from "./types";
import { createChatCompletion } from "./openai-compatible-client";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export async function medgemmaGenerateTreatmentPlan(params: {
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
  used: { provider: "medgemma"; endpoint: string };
}> {
  const endpoint = readEnv("MEDGEMMA_ENDPOINT");
  if (!endpoint) {
    throw new Error("medgemma_not_configured");
  }

  const apiKey = readEnv("MEDGEMMA_API_KEY") ?? undefined;
  const model = readEnv("MEDGEMMA_MODEL") ?? undefined;

  const system = [
    "You are a point-of-care triage assistant for low-resource clinics.",
    "You MUST be culturally appropriate and practical for remote communities.",
    "You MUST include safety caveats and when to refer/escalate.",
    "Do not present output as a definitive diagnosis.",
  ].join("\n");

  const user = [
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

  const completion = await createChatCompletion({
    baseUrl: endpoint,
    apiKey,
    requestId: params.requestId,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    responseFormatJsonSchema: {
      name: "HealthTriageTreatmentPlan",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          treatment_plan: { type: "string" },
          referral_recommendation: { type: "string" },
          red_flags: { type: "array", items: { type: "string" } },
          disclaimer: { type: "string" },
        },
        required: ["treatment_plan", "red_flags", "disclaimer"],
      },
    },
    temperature: 0.2,
    timeoutMs: 45_000,
  });

  const content = completion.choices[0]?.message?.content;
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("medgemma_invalid_json_output");
  }

  return {
    treatment_plan: String(parsed.treatment_plan ?? ""),
    referral_recommendation:
      typeof parsed.referral_recommendation === "string" ? parsed.referral_recommendation : undefined,
    red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String) : [],
    disclaimer: String(parsed.disclaimer ?? ""),
    used: { provider: "medgemma", endpoint },
  };
}

export async function medgemmaInterpretFallback(params: {
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
  used: { provider: "medgemma"; endpoint: string };
}> {
  const endpoint = readEnv("MEDGEMMA_ENDPOINT");
  if (!endpoint) {
    throw new Error("medgemma_not_configured");
  }
  const apiKey = readEnv("MEDGEMMA_API_KEY") ?? undefined;
  const model = readEnv("MEDGEMMA_MODEL") ?? undefined;

  const system = [
    "You are a point-of-care triage assistant for low-resource clinics.",
    "Return triage interpretation with uncertainty and referral guidance.",
    "Output must be JSON only matching the schema.",
  ].join("\n");

  const userText = [
    `Modality: ${params.modality}`,
    params.locale ? `Locale: ${params.locale}` : "",
    params.processedSummary ? `Processing summary: ${params.processedSummary}` : "",
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = params.imageUrlOrData
    ? ([
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: params.imageUrlOrData } },
      ] as const)
    : userText;

  const completion = await createChatCompletion({
    baseUrl: endpoint,
    apiKey,
    requestId: params.requestId,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent as any },
    ],
    responseFormatJsonSchema: {
      name: "HealthTriageInterpretationFallback",
      schema: {
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
      },
    },
    temperature: 0.2,
    timeoutMs: 45_000,
  });

  const content = completion.choices[0]?.message?.content;
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("medgemma_invalid_json_output");
  }

  return {
    triage_level: parsed.triage_level,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    narrative: String(parsed.narrative ?? ""),
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    used: { provider: "medgemma", endpoint },
  };
}

export async function medgemmaWellnessSynthesis(params: {
  requestId: string;
  locale?: string;
  cognitive_state: Record<string, unknown>;
  eeg_decode: Record<string, unknown>;
  huatuo_narrative?: string;
  context?: Record<string, unknown>;
}): Promise<{
  wellness_summary?: string;
  coaching_message: string;
  recommendations: string[];
  clinical_style_summary?: string;
  red_flags: string[];
  disclaimer: string;
  used: { provider: "medgemma"; endpoint: string };
}> {
  const endpoint = readEnv("MEDGEMMA_ENDPOINT");
  if (!endpoint) {
    throw new Error("medgemma_not_configured");
  }

  const apiKey = readEnv("MEDGEMMA_API_KEY") ?? undefined;
  const model = readEnv("MEDGEMMA_MODEL") ?? undefined;

  const system = [
    "You support cognitive wellness and mental-health adjacent coaching for apps (burnout, focus, aging-related screening games).",
    "You are NOT providing a medical or psychiatric diagnosis.",
    "Use cautious language; encourage professional care when appropriate.",
    "Output must be JSON only matching the schema.",
  ].join("\n");

  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Cognitive_state (JSON): ${JSON.stringify(params.cognitive_state).slice(0, 6000)}`,
    `EEG_decode_envelope (JSON): ${JSON.stringify(params.eeg_decode).slice(0, 4000)}`,
    params.huatuo_narrative
      ? `Vision_assisted_notes (from screenshot analysis, non-diagnostic): ${params.huatuo_narrative.slice(0, 4000)}`
      : "",
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 6000)}` : "",
    "Task: (1) Optional one-line wellness_summary if helpful, (2) coaching_message for the user, (3) recommendations list, (4) optional clinical_style_summary for a clinician (observations only, not diagnosis), (5) red_flags for urgent escalation hints, (6) disclaimer.",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await createChatCompletion({
    baseUrl: endpoint,
    apiKey,
    requestId: params.requestId,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    responseFormatJsonSchema: {
      name: "CognitiveWellnessSynthesis",
      schema: {
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
      },
    },
    temperature: 0.2,
    timeoutMs: 45_000,
  });

  const content = completion.choices[0]?.message?.content;
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("medgemma_invalid_json_output");
  }

  return {
    wellness_summary: typeof parsed.wellness_summary === "string" ? parsed.wellness_summary : undefined,
    coaching_message: String(parsed.coaching_message ?? ""),
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
    clinical_style_summary:
      typeof parsed.clinical_style_summary === "string" ? parsed.clinical_style_summary : undefined,
    red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String) : [],
    disclaimer: String(parsed.disclaimer ?? ""),
    used: { provider: "medgemma", endpoint },
  };
}

