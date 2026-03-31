import { getCampaignGeminiClient } from "@/lib/campaigns/gemini-client";
import {
  generateHealthJsonWithRetry,
  getHealthGeminiModelId,
  parseJsonObject,
} from "@/lib/health/gemini-fallback";
import { createChatCompletion } from "@/lib/health/openai-compatible-client";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

/**
 * MedGemma (OpenAI-compatible JSON) -> Gemini structured JSON.
 * Used by clinical decision APIs for consistent fallback and monitoring via routing_fallbacks.
 */
export async function runClinicalTextJsonChain(params: {
  requestId: string;
  locale?: string;
  systemPrompt: string;
  userContent: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}): Promise<{ parsed: Record<string, unknown>; routing_fallbacks: string[] }> {
  const routing_fallbacks: string[] = [];
  const endpoint = readEnv("MEDGEMMA_ENDPOINT");

  if (endpoint) {
    try {
      const apiKey = readEnv("MEDGEMMA_API_KEY") ?? undefined;
      const model = readEnv("MEDGEMMA_MODEL") ?? undefined;
      const completion = await createChatCompletion({
        baseUrl: endpoint,
        apiKey,
        requestId: params.requestId,
        model,
        messages: [
          { role: "system", content: params.systemPrompt },
          {
            role: "user",
            content: [
              params.locale ? `Locale: ${params.locale}\n` : "",
              params.userContent,
            ].join(""),
          },
        ],
        responseFormatJsonSchema: {
          name: params.schemaName,
          schema: params.jsonSchema,
        },
        temperature: 0.2,
        timeoutMs: 60_000,
      });
      const content = completion.choices[0]?.message?.content;
      const raw = typeof content === "string" ? content : JSON.stringify(content);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return { parsed, routing_fallbacks };
    } catch (e) {
      routing_fallbacks.push(e instanceof Error ? e.message : "medgemma_failed");
    }
  } else {
    routing_fallbacks.push("medgemma_not_configured");
  }

  const ai = getCampaignGeminiClient();
  const primaryModel = getHealthGeminiModelId();
  const fullUser = [params.systemPrompt, "", params.userContent].join("\n");
  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel,
    contents: [{ role: "user", parts: [{ text: fullUser }] }],
    schema: params.jsonSchema,
  });
  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    throw new Error("gemini_clinical_invalid_json");
  }
  routing_fallbacks.push("used_gemini_fallback");
  return { parsed, routing_fallbacks };
}
