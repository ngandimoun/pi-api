import type { Incident, IncidentNarration, PerceptionResult } from "../../contracts/surveillance-api";
import { getCampaignGeminiClient } from "../campaigns/gemini-client";
import { generateHealthJsonWithRetry, parseJsonObject } from "../health/gemini-fallback";

const NARRATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    description: { type: "string" },
    recommended_action: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["summary", "description"],
} as const;

/**
 * Model id for surveillance narration (env-driven; never expose to API consumers).
 */
export function getSurveillanceGeminiModelId(): string {
  const explicit = process.env.SURVEILLANCE_GEMINI_MODEL?.trim();
  if (explicit) return explicit;
  return (
    process.env.GOOGLE_DEFAULT_MODEL?.trim() ||
    process.env.GOOGLE_CAMPAIGN_ORCHESTRATOR_MODEL?.trim() ||
    process.env.HEALTH_GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash"
  );
}

export async function narrateIncident(params: {
  incident: Incident;
  perception: PerceptionResult;
  context?: Record<string, unknown>;
  locale?: string;
}): Promise<IncidentNarration> {
  const model = getSurveillanceGeminiModelId();
  const ai = getCampaignGeminiClient();

  const system = [
    "You are a security operations assistant for video surveillance summaries.",
    "Describe incidents clearly for operators. Do not claim certainty about identity or intent.",
    "Output must be JSON only matching the schema.",
  ].join("\n");

  const userText = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Incident summary (JSON): ${JSON.stringify({
      type: params.incident.type,
      severity: params.incident.severity,
      zone: params.incident.zone,
      track_ids: params.incident.tracks.map((t) => t.track_id),
      anomaly_score: params.incident.anomaly_score,
    })}`,
    `Perception context (JSON, truncated): ${JSON.stringify({
      frame_index: params.perception.frame_index,
      detections_count: params.perception.detections.length,
      tracks_count: params.perception.tracks.length,
    })}`,
    params.context ? `Site context (JSON): ${JSON.stringify(params.context).slice(0, 4000)}` : "",
    "Task: produce a concise operator-facing summary and description.",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ text: [system, "", userText].join("\n") }],
    schema: NARRATION_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    return {
      summary: "Incident detected (narration unavailable).",
      description: "Automated narration could not be generated.",
      recommended_action: "Review the live feed and confirm with local procedures.",
      confidence: 0.3,
    };
  }

  const summary = String(parsed.summary ?? "").trim() || "Incident summary.";
  const description = String(parsed.description ?? "").trim() || "Incident description.";
  const recommended_action =
    typeof parsed.recommended_action === "string" ? parsed.recommended_action : undefined;
  const confidence =
    typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : 0.7;

  return {
    summary,
    description,
    recommended_action,
    confidence,
  };
}

export async function narrateIncidents(params: {
  incidents: Incident[];
  perception: PerceptionResult;
  context?: Record<string, unknown>;
  locale?: string;
}): Promise<Incident[]> {
  const out: Incident[] = [];
  for (const inc of params.incidents) {
    const narration = await narrateIncident({
      incident: inc,
      perception: params.perception,
      context: params.context,
      locale: params.locale,
    });
    out.push({ ...inc, narration });
  }
  return out;
}
