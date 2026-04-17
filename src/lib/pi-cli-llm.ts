import { createGoogleGenerativeAI } from "@ai-sdk/google";

const LITE_MODEL = "gemini-3.1-flash-lite-preview";
const PRO_MODEL = "gemini-3.1-pro-preview";

export type PiCliTaskComplexity = "lite" | "pro";

/**
 * Model for Pi CLI structured JSON / text (env-driven; tier defaults).
 * - `lite`: fast, cost-efficient (classification, extraction, simple prompts).
 * - `pro`: heavier reasoning (routine spec generation, complex structured output).
 */
export function getPiCliGeminiModel(complexity: PiCliTaskComplexity = "lite") {
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_KEY for Pi CLI routes.");
  }

  const modelId =
    complexity === "pro"
      ? process.env.PI_CLI_GEMINI_PRO_MODEL?.trim() || PRO_MODEL
      : process.env.PI_CLI_GEMINI_MODEL?.trim() ||
        process.env.GOOGLE_DEFAULT_MODEL?.trim() ||
        LITE_MODEL;

  const google = createGoogleGenerativeAI({ apiKey: key });
  return google(modelId);
}
