import { Modality, ThinkingLevel } from "@google/genai";

import type { NormalizedReferenceImage } from "@/lib/ads/reference-inputs";
import { extractFinalImageFromResponse } from "@/lib/ads/image-generate";
import { getCampaignGeminiClient, getCampaignImageModelId } from "@/lib/campaigns/gemini-client";

export async function editCampaignImage(params: {
  /** The canonical source image to edit (loaded from the source job's payload). */
  source: NormalizedReferenceImage;
  /** Instruction for how to change the existing image. */
  editPrompt: string;
  /** Optional developer-provided additional references. */
  references: NormalizedReferenceImage[];
  /** Gemini imageConfig.aspectRatio (e.g. "4:5"). */
  aspectRatio: string;
  /** Gemini imageConfig.imageSize (e.g. "1K"). */
  imageSize: string;
  /** Gemini image thinking config. */
  thinkingIntensity?: "minimal" | "high";
}): Promise<Buffer> {
  const ai = getCampaignGeminiClient();
  const model = getCampaignImageModelId();

  const contents: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    {
      text: [
        "You are editing a previously generated static campaign ad image.",
        "Follow the developer instruction precisely.",
        "Do not add new brand identifiers or unrelated elements unless explicitly requested.",
        "INSTRUCTION:",
        params.editPrompt,
      ].join("\n"),
    },
    {
      inlineData: {
        data: params.source.buffer.toString("base64"),
        mimeType: params.source.mimeType,
      },
    },
    ...params.references.map((ref) => ({
      inlineData: {
        data: ref.buffer.toString("base64"),
        mimeType: ref.mimeType,
      },
    })),
  ];

  const thinkingLevel =
    params.thinkingIntensity === "minimal"
      ? ThinkingLevel.MINIMAL
      : params.thinkingIntensity === "high"
        ? ThinkingLevel.HIGH
        : undefined;

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: {
        aspectRatio: params.aspectRatio,
        imageSize: params.imageSize,
      },
      ...(thinkingLevel
        ? {
            thinkingConfig: { thinkingLevel, includeThoughts: false as const },
          }
        : {}),
    },
  });

  return extractFinalImageFromResponse(response);
}

