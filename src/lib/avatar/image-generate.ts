import { GoogleGenAI, Modality, type GenerateContentResponse, type ThinkingLevel } from "@google/genai";

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export type ReferencePart = {
  buffer: Buffer;
  mimeType: string;
};

export class ImageGenerationError extends Error {
  readonly code: "image_generation_blocked" | "image_generation_empty";

  constructor(code: ImageGenerationError["code"], message: string) {
    super(message);
    this.name = "ImageGenerationError";
    this.code = code;
  }
}

/**
 * Maps coarse aspect hints to Gemini imageConfig aspectRatio when possible.
 */
export function mapAspectRatio(hints: Record<string, unknown> | undefined): string {
  const composition = typeof hints?.avatar_composition === "string" ? hints.avatar_composition : "";
  if (/full body/i.test(composition)) return "2:3";
  if (/portrait|bust|headshot/i.test(composition)) return "3:4";
  if (/upper body/i.test(composition)) return "4:5";
  return "1:1";
}

/**
 * Picks the last non-thought inline image from the response (final deliverable after thinking chain).
 */
export function extractFinalImageFromResponse(response: GenerateContentResponse): Buffer {
  if (response.promptFeedback?.blockReason) {
    throw new ImageGenerationError(
      "image_generation_blocked",
      `Prompt blocked (${response.promptFeedback.blockReason}).`
    );
  }

  const candidates = response.candidates ?? [];
  if (candidates.length === 0) {
    throw new ImageGenerationError(
      "image_generation_blocked",
      "Image generation returned no candidates."
    );
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
    const policyStop = candidates.some(
      (c) => c.finishReason === "SAFETY" || c.finishReason === "RECITATION"
    );
    throw new ImageGenerationError(
      policyStop ? "image_generation_blocked" : "image_generation_empty",
      policyStop
        ? "Image generation was blocked by safety or policy."
        : "Image generation returned no image part."
    );
  }

  return last;
}

/**
 * Generates a new avatar image from a text prompt and reference images.
 */
export async function generateAvatarImage(params: {
  prompt: string;
  references: ReferencePart[];
  aspectRatio: string;
  imageSize: string;
  thinkingLevel?: ThinkingLevel;
}): Promise<Buffer> {
  const ai = new GoogleGenAI({
    apiKey: readEnv("GEMINI_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  });

  const contents: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    {
      text: `${params.prompt}\n\nOutput: single high-quality character avatar image matching the brief.`,
    },
  ];
  for (const ref of params.references) {
    contents.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.buffer.toString("base64"),
      },
    });
  }

  const thinkingConfig =
    params.thinkingLevel !== undefined
      ? { thinkingLevel: params.thinkingLevel, includeThoughts: false as const }
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
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  });

  return extractFinalImageFromResponse(response);
}