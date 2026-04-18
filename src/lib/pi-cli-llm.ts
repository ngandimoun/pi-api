import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { encodeChat } from "gpt-tokenizer";

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

/**
 * Token count estimate for budgeting. Uses gpt-tokenizer (GPT-4 approximation).
 * (@google/genai no longer exposes the legacy GoogleGenerativeAI countTokens API used here.)
 */
export async function getTokenCount(
  text: string,
  _complexity: PiCliTaskComplexity = "lite"
): Promise<number> {
  return offlineTokenCount(text);
}

/**
 * Offline token count estimate using gpt-tokenizer (GPT-4 approximation).
 * Less accurate for Gemini but better than byte counts.
 */
function offlineTokenCount(text: string): number {
  try {
    const tokens = encodeChat([{ role: "user", content: text }], "gpt-4");
    return tokens.length;
  } catch {
    // Ultra fallback: ~4 chars per token heuristic
    return Math.ceil(text.length / 4);
  }
}

export class PiTokenBudgetError extends Error {
  constructor(
    message: string,
    public readonly tokenCount: number,
    public readonly limit: number,
    public readonly label?: string
  ) {
    super(message);
    this.name = "PiTokenBudgetError";
  }
}

/**
 * Wrapper that enforces token budgets for LLM calls.
 * Pre-flight checks input token count and throws PiTokenBudgetError if exceeded.
 * Automatically sets maxOutputTokens on the model call.
 */
export async function withTokenBudget<T>(
  opts: {
    complexity: PiCliTaskComplexity;
    prompt: string;
    maxInputTokens?: number;
    maxOutputTokens: number;
    label?: string;
  },
  call: (model: ReturnType<typeof getPiCliGeminiModel>, config: { maxOutputTokens: number }) => Promise<T>
): Promise<T> {
  const defaultMaxInput = opts.complexity === "pro" ? 200_000 : 100_000;
  const maxInput = opts.maxInputTokens ?? defaultMaxInput;

  // Pre-flight token count check
  const tokenCount = await getTokenCount(opts.prompt, opts.complexity);
  
  if (tokenCount > maxInput) {
    throw new PiTokenBudgetError(
      `Input exceeds ${maxInput} token limit (${tokenCount} tokens). Consider truncating context or splitting the request.`,
      tokenCount,
      maxInput,
      opts.label
    );
  }

  const model = getPiCliGeminiModel(opts.complexity);
  return call(model, { maxOutputTokens: opts.maxOutputTokens });
}
