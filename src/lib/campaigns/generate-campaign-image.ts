import { Modality, ThinkingLevel } from "@google/genai";

import { extractFinalImageFromResponse } from "@/lib/ads/image-generate";
import { getCampaignGeminiClient, getCampaignImageModelId } from "@/lib/campaigns/gemini-client";

export type CampaignReferencePart = {
  buffer: Buffer;
  mimeType: string;
};

export async function generateCampaignImage(params: {
  compiledPrompt: string;
  jsonPrompt: Record<string, unknown>;
  references: CampaignReferencePart[];
  aspectRatio: string;
  imageSize: string;
  thinkingIntensity?: "minimal" | "high";
}): Promise<Buffer> {
  const ai = getCampaignGeminiClient();
  const model = getCampaignImageModelId();

  const contents: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    {
      text: [
        params.compiledPrompt,
        "",
        "JSON_PROMPT_CONTEXT:",
        JSON.stringify(params.jsonPrompt),
      ].join("\n"),
    },
  ];

  for (const ref of params.references) {
    contents.push({
      inlineData: {
        data: ref.buffer.toString("base64"),
        mimeType: ref.mimeType,
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
    model,
    contents,
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: {
        aspectRatio: params.aspectRatio,
        imageSize: params.imageSize,
      },
      ...(thinkingLevel
        ? { thinkingConfig: { thinkingLevel, includeThoughts: false as const } }
        : {}),
    },
  });

  return extractFinalImageFromResponse(response);
}
