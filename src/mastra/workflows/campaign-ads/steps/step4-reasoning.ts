import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getCampaignGeminiClient, getCampaignOrchestratorModelId } from "@/lib/campaigns/gemini-client";
import { step4OutputSchema } from "@/mastra/workflows/campaign-ads/schemas";

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

export const step4Reasoning = createStep({
  id: "campaign-step4-reasoning",
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
            "Keys: keep (array), remove (array), add (array), composition_plan, style_notes.",
            "Compare the target summary with the corpus image. Flag what to remove and what to add.",
            "Also analyze cultural-awareness gaps between the corpus image and the target audience, then include concrete cultural adjustments in add/remove/style_notes so the final ad resonates better with that audience.",
            "Pay strict attention to pricing and commercial copy fidelity: preserve or recommend exact price formats, correct currency symbols/codes, decimal/group separators, and locale-specific number conventions.",
            "Also flag any marketing-critical details that must be corrected or improved: product names, units/quantities, promo terms, dates/deadlines, CTA wording/placement, legal/compliance text, and contact details (phone/URL).",
            `SUMMARY: ${inputData.step2.summary}`,
            `TARGET_AUDIENCE: ${inputData.step2.target_audience}`,
            `KEYWORDS: ${JSON.stringify(inputData.step2.keywords)}`,
            `CORPUS_IMAGE_URL: ${inputData.step3.corpus_image_url}`,
            `CORPUS_METADATA: ${JSON.stringify(inputData.step3.corpus_metadata)}`,
          ].join("\n"),
        },
        {
          inlineData: {
            data: inputData.step3.corpus_image_base64,
            mimeType: inputData.step3.corpus_mime_type,
          },
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    const parsed = parseJsonObject(text);

    const step4 = step4OutputSchema.parse(
      z
        .object({
          keep: z.array(z.string()).default([]),
          remove: z.array(z.string()).default([]),
          add: z.array(z.string()).default([]),
          composition_plan: z.string().min(1),
          style_notes: z.string().min(1),
        })
        .parse(parsed)
    );
    return { ...inputData, step4 };
  },
});
