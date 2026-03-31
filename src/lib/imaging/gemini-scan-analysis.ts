import { runClinicalTextJsonChain } from "@/lib/clinical/clinical-json-fallback";

const S4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    findings: { type: "array", items: { type: "object", additionalProperties: true } },
    impression: { type: "string" },
    plain_language_explanation: { type: "string" },
    anomalies_detected: { type: "boolean" },
    recommended_followup: { type: "string" },
    urgency: { type: "string", enum: ["stat", "routine", "non_urgent"] },
    differential: { type: "array", items: { type: "object", additionalProperties: true } },
    measurements: { type: "array", items: { type: "object", additionalProperties: true } },
    risk_flags: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: [
    "findings",
    "impression",
    "plain_language_explanation",
    "anomalies_detected",
    "recommended_followup",
    "urgency",
    "differential",
    "measurements",
    "risk_flags",
    "disclaimer",
  ],
} as const;

export async function scanStructuredReportStep4(params: {
  requestId: string;
  locale?: string;
  modality: string;
  clinicalQuestion?: string;
  priorInterpretation: {
    narrative: string;
    findings_json: string;
    triage_level: string;
    fallbacks: string[];
  };
  monaiSummary: string | null;
  overlayUrl: string | null;
  context?: Record<string, unknown>;
}) {
  const system =
    "You convert imaging-assistant outputs into structured radiology-style reporting for developers. Non-diagnostic; encourage specialist review when uncertain. JSON only.";
  const user = [
    params.locale ? `Locale: ${params.locale}` : "",
    `Modality: ${params.modality}`,
    params.clinicalQuestion ? `Clinical_question: ${params.clinicalQuestion}` : "",
    `Prior_narrative: ${params.priorInterpretation.narrative.slice(0, 12_000)}`,
    `Prior_findings (JSON): ${params.priorInterpretation.findings_json.slice(0, 20_000)}`,
    `Prior_triage_level: ${params.priorInterpretation.triage_level}`,
    `Routing_fallbacks: ${JSON.stringify(params.priorInterpretation.fallbacks)}`,
    params.monaiSummary ? `MONAI_processing: ${params.monaiSummary.slice(0, 4000)}` : "",
    params.overlayUrl ? `Segmentation_overlay_url: ${params.overlayUrl}` : "",
    params.context ? `Context: ${JSON.stringify(params.context).slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return runClinicalTextJsonChain({
    requestId: params.requestId,
    locale: params.locale,
    systemPrompt: system,
    userContent: user,
    schemaName: "ScanStructuredReport",
    jsonSchema: S4 as unknown as Record<string, unknown>,
  });
}
