import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type GenerateContentResponse,
} from "@google/genai";

export class AdImageGenerationError extends Error {
  readonly code:
    | "generation_blocked"
    | "generation_empty"
    | "generation_config_invalid"
    | "generation_failed";

  constructor(code: AdImageGenerationError["code"], message: string) {
    super(message);
    this.name = "AdImageGenerationError";
    this.code = code;
  }
}

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export type AdReferencePart = {
  buffer: Buffer;
  mimeType: string;
};

export function extractFinalImageFromResponse(response: GenerateContentResponse): Buffer {
  if (response.promptFeedback?.blockReason) {
    throw new AdImageGenerationError(
      "generation_blocked",
      `Prompt blocked (${response.promptFeedback.blockReason}).`
    );
  }

  const candidates = response.candidates ?? [];
  if (candidates.length === 0) {
    throw new AdImageGenerationError("generation_empty", "Generation returned no candidates.");
  }

  let last: Buffer | null = null;
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.thought === true) continue;
      const data = part.inlineData?.data;
      if (data) {
        last = Buffer.from(data, "base64");
      }
    }
  }

  if (!last) {
    throw new AdImageGenerationError("generation_empty", "Generation returned no image part.");
  }
  return last;
}

export async function generateAdImage(params: {
  prompt: string;
  references: AdReferencePart[];
  aspectRatio: string;
  imageSize: string;
  thinkingIntensity?: "minimal" | "high";
}): Promise<Buffer> {
  const ai = new GoogleGenAI({
    apiKey: readEnv("GEMINI_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  });

  const contents: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: params.prompt },
  ];
  for (const ref of params.references) {
    contents.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.buffer.toString("base64"),
      },
    });
  }

  const thinkingLevel =
    params.thinkingIntensity === "minimal"
      ? ThinkingLevel.MINIMAL
      : params.thinkingIntensity === "high"
        ? ThinkingLevel.HIGH
        : undefined;

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents,
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: {
        aspectRatio: params.aspectRatio,
        imageSize: params.imageSize,
      },
      ...(thinkingLevel
        ? {
            thinkingConfig: {
              thinkingLevel,
              includeThoughts: false as const,
            },
          }
        : {}),
    },
  });

  return extractFinalImageFromResponse(response);
}

