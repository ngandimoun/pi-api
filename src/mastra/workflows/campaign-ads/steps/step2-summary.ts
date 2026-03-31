import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getCampaignGeminiClient, getCampaignOrchestratorModelId } from "../../../../lib/campaigns/gemini-client";

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

export const step2Summary = createStep({
  id: "campaign-step2-summary",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const ai = getCampaignGeminiClient();
    const model = getCampaignOrchestratorModelId();

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          text: [
            "Return ONLY one JSON object.",
            "Keys: summary, keywords (array), style_direction, language, color_palette, style_of_ad, cultural_context, type_of_product, type_of_campaign, type_of_audience, type_of_message, target_audience.",
            `PROMPT: ${inputData.input.prompt}`,
            `PROMPT_ANALYSIS: ${JSON.stringify(inputData.step1.prompt_analysis)}`,
            `IMAGE_ANALYSES: ${JSON.stringify(inputData.step1.image_analyses)}`,
            `COMBINED_INTENT: ${inputData.step1.combined_intent}`,
          ].join("\n"),
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    const step2 = z
      .object({
        summary: z.string().min(1),
        keywords: z.array(z.string().min(1)).max(20).default([]),
        style_direction: z.string().min(1),
        language: z.string().min(1),
        color_palette: z.string().min(1),
        style_of_ad: z.string().min(1),
        cultural_context: z.string().min(1),
        type_of_product: z.string().min(1),
        type_of_campaign: z.string().min(1),
        type_of_audience: z.string().min(1),
        type_of_message: z.string().min(1),
        target_audience: z.string().min(1),
      })
      .parse(parseJsonObject(text));

    return { ...inputData, step2 };
  },
});
