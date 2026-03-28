import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getCampaignGeminiClient, getCampaignOrchestratorModelId } from "@/lib/campaigns/gemini-client";
import { normalizeReferenceImages } from "@/lib/ads/reference-inputs";
import { resolveBrandConditioning } from "@/lib/ads/brand-conditioning";
import { campaignWorkflowInputSchema } from "@/mastra/workflows/campaign-ads/schemas";

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

export const step1Understanding = createStep({
  id: "campaign-step1-understanding",
  inputSchema: campaignWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const ai = getCampaignGeminiClient();
    const model = getCampaignOrchestratorModelId();

    const brandConditioning = await resolveBrandConditioning({
      input: {
        brand_id: inputData.input.brand_id,
        brand_identity_json: inputData.input.brand_identity_json,
      },
      organizationId: inputData.organization_id,
    });

    const understandingResponse = await ai.models.generateContent({
      model,
      contents: [
        {
          text: [
            "Return ONLY one JSON object.",
            "Keys: inferred_objective, product_focus, cultural_context, type_of_product, target_market, type_of_campaign, type_of_audience, type_of_message, style_of_ad, language_code, include_human.",
            `PROMPT: ${inputData.input.prompt}`,
            brandConditioning.active
              ? `BRAND_CONSTRAINTS: ${brandConditioning.constraints.slice(0, 10).join(" | ")}`
              : "BRAND_CONSTRAINTS: none",
          ].join("\n"),
        },
      ],
    });

    const understandingText =
      understandingResponse.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    const prompt_analysis = z
      .object({
        inferred_objective: z.string().min(1),
        product_focus: z.string().min(1),
        cultural_context: z.string().min(1),
        type_of_product: z.string().min(1),
        target_market: z.string().min(1),
        type_of_campaign: z.string().min(1),
        type_of_audience: z.string().min(1),
        type_of_message: z.string().min(1),
        style_of_ad: z.string().min(1),
        language_code: z.string().min(2),
        include_human: z.boolean(),
      })
      .parse(parseJsonObject(understandingText));

    const refs = await normalizeReferenceImages(inputData.input.reference_images);
    const image_analyses: string[] = [];
    if (refs.length > 0) {
      for (const ref of refs) {
        const visionResponse = await ai.models.generateContent({
          model,
          contents: [
            {
              text: "Describe this marketing reference image in one compact sentence: composition, style, text density, background, logo_placement, color_palette, text_density, text_language, text_writing_style, text_meaning, numbers, human_presence, product_visibility, notable_copy_language and subject.",
            },
            {
              inlineData: {
                data: ref.buffer.toString("base64"),
                mimeType: ref.mimeType,
              },
            },
          ],
        });

        const text =
          visionResponse.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(" ").trim() ?? "";
        if (text) image_analyses.push(text);
      }
    }

    const combined_intent = [
      prompt_analysis.inferred_objective,
      prompt_analysis.product_focus,
      `market:${prompt_analysis.target_market}`,
      `lang:${prompt_analysis.language_code}`,
      image_analyses.join(" | "),
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      ...inputData,
      step1: {
        prompt_analysis,
        image_analyses,
        combined_intent,
        brand_constraints: brandConditioning.constraints,
        brand_projection: brandConditioning.brandProjection,
      },
    };
  },
});
