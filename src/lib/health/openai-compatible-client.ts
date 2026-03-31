import { z } from "zod";

const chatCompletionSchema = z.object({
  id: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.string().optional(),
          content: z.union([z.string(), z.array(z.unknown())]).optional(),
        }),
      })
    )
    .min(1),
  usage: z.record(z.unknown()).optional(),
});

export type OpenAiChatCompletion = z.infer<typeof chatCompletionSchema>;

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | Record<string, unknown>
      >;
};

export async function createChatCompletion(params: {
  baseUrl: string;
  apiKey?: string;
  requestId: string;
  model?: string;
  messages: OpenAiChatMessage[];
  responseFormatJsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<OpenAiChatCompletion> {
  const baseUrl = params.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = {
      ...(params.model ? { model: params.model } : {}),
      messages: params.messages,
      ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    };

    if (params.responseFormatJsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: params.responseFormatJsonSchema,
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
        "X-Request-Id": params.requestId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`openai_compatible_http_${res.status}: ${text.slice(0, 500)}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("openai_compatible_invalid_json");
    }

    const parsed = chatCompletionSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error("openai_compatible_invalid_response_shape");
    }
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

