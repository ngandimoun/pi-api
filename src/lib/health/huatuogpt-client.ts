import type { HealthTriageFinding } from "./types";
import { createChatCompletion } from "./openai-compatible-client";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export async function huatuoInterpretImage(params: {
  requestId: string;
  locale?: string;
  modality: string;
  imageUrlOrData: string;
  context?: Record<string, unknown>;
}): Promise<{
  findings: HealthTriageFinding[];
  triage_level: "critical" | "urgent" | "standard" | "low";
  confidence: number;
  narrative: string;
  used: { provider: "huatuogpt"; endpoint: string };
}> {
  const endpoint = readEnv("HUATUOGPT_ENDPOINT");
  if (!endpoint) {
    throw new Error("huatuogpt_not_configured");
  }

  const apiKey = readEnv("HUATUOGPT_API_KEY") ?? undefined;
  const model = readEnv("HUATUOGPT_MODEL") ?? undefined;

  const system = [
    "You are a point-of-care triage assistant for low-resource clinics.",
    "Return a concise, culturally appropriate triage summary.",
    "Do not claim a definitive diagnosis; provide differential + red flags + referral guidance.",
    "Output must be JSON only, matching the requested schema.",
  ].join("\n");

  const userText = [
    `Modality: ${params.modality}`,
    params.locale ? `Locale: ${params.locale}` : "",
    params.context ? `Context (JSON): ${JSON.stringify(params.context).slice(0, 8000)}` : "",
    "Task: Interpret the image for triage. Provide findings, triage_level, confidence (0-1), and a short narrative.",
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
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: {
              url: params.imageUrlOrData,
            },
          },
        ],
      },
    ],
    responseFormatJsonSchema: {
      name: "HealthTriageInterpretation",
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
    throw new Error("huatuogpt_invalid_json_output");
  }

  return {
    triage_level: parsed.triage_level,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    narrative: String(parsed.narrative ?? ""),
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    used: { provider: "huatuogpt", endpoint },
  };
}

