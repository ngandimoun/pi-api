import { getCampaignGeminiClient, getCampaignOrchestratorModelId } from "@/lib/campaigns/gemini-client";
import type { Json } from "@/types/database";

import { validateJsonSchemaSubset } from "@/lib/voice/json-schema-validate-lite";

function parseJsonObject(text: string): Record<string, unknown> {
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

export type ExtractVoiceResultsOutcome = {
  results: Json;
  extraction_warnings: string[];
};

/**
 * Post-session: map transcript + output_schema hints (and optional strict JSON Schema) to structured JSON via Gemini generateContent.
 */
export async function extractStructuredVoiceResults(input: {
  transcript: Array<{ role: "agent" | "user"; text: string; timestamp?: number }>;
  outputSchema: Record<string, string>;
  outputSchemaStrict?: Record<string, unknown> | null;
  extractionModel?: string | null;
}): Promise<ExtractVoiceResultsOutcome> {
  const model =
    (input.extractionModel && input.extractionModel.trim()) || getCampaignOrchestratorModelId();
  const ai = getCampaignGeminiClient();

  const schemaLines = Object.entries(input.outputSchema)
    .map(([k, v]) => `  "${k}": <${v}>`)
    .join("\n");

  const transcriptText = input.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");

  const strict = input.outputSchemaStrict;
  const useStrict = strict && typeof strict === "object" && !Array.isArray(strict);

  const prompt = [
    "Return ONLY one JSON object. No markdown fences.",
    "Extract structured information from the voice conversation transcript below.",
    useStrict
      ? "Your JSON MUST conform to the provided JSON Schema (types, required fields)."
      : "Keys and expected types (follow hints; use null if unknown):",
    useStrict ? "" : schemaLines || "  (no strict schema — return a compact JSON summary object)",
    "",
    "TRANSCRIPT:",
    transcriptText,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const config: Record<string, unknown> = {};
  if (useStrict) {
    config.responseMimeType = "application/json";
    config.responseJsonSchema = strict;
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ text: prompt }],
    ...(Object.keys(config).length > 0 ? { config: config as never } : {}),
  });

  const text =
    response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";

  let raw: Record<string, unknown>;
  try {
    raw = parseJsonObject(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse_failed";
    return {
      results: { _parse_error: msg } as Json,
      extraction_warnings: [`extraction_parse_failed: ${msg}`],
    };
  }

  const extraction_warnings: string[] = [];

  if (useStrict) {
    const schemaErrors = validateJsonSchemaSubset(strict, raw);
    if (schemaErrors.length > 0) {
      extraction_warnings.push(
        ...schemaErrors.map((e) => `schema_validation: ${e}`),
        "Returning best-effort parsed JSON despite validation issues."
      );
    }
  }

  return { results: raw as Json, extraction_warnings };
}
