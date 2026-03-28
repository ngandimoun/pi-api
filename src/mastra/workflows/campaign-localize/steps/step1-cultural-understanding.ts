import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getCampaignGeminiClient, getCampaignOrchestratorModelId } from "@/lib/campaigns/gemini-client";
import { normalizeReferenceImages } from "@/lib/ads/reference-inputs";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { appendInMemoryDiagnostic, appendJobDiagnostic } from "@/mastra/workflows/campaign-localize/diagnostics";
import { campaignLocalizeWorkflowInputSchema, step1LocalizeOutputSchema } from "@/mastra/workflows/campaign-localize/schemas";

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

async function getBrandDna(organizationId: string, brandId: string): Promise<Record<string, unknown> | null> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id,org_id,brand_dna")
    .eq("id", brandId)
    .maybeSingle();

  if (error || !data) return null;
  if (String(data.org_id) !== organizationId) return null;
  const dna = data.brand_dna;
  if (!dna || typeof dna !== "object" || Array.isArray(dna)) return null;
  return dna as Record<string, unknown>;
}

export const step1CulturalUnderstanding = createStep({
  id: "campaign-localize-step1-cultural-understanding",
  inputSchema: campaignLocalizeWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const startedAt = Date.now();
    const ai = getCampaignGeminiClient();
    const model = getCampaignOrchestratorModelId();

    try {
      // Required: exactly one source image.
      const sourceImageUrl = inputData.input.source_image_url;
      if (!sourceImageUrl) {
        throw new Error("source_image_missing");
      }
      const [source] = await normalizeReferenceImages([sourceImageUrl], 1);
      if (!source) {
        throw new Error("source_image_missing");
      }

      const brandDna =
        inputData.input.brand_id ? await getBrandDna(inputData.organization_id, inputData.input.brand_id) : null;

      const visionResponse = await ai.models.generateContent({
        model,
        contents: [
          {
            text: [
              "Return ONLY one JSON object.",
              "Keys: has_human (boolean), ocr_text (string), layout_description (string), subject_description (string), product_description (string), color_palette (string).",
              "Analyze this ad image for localization while preserving exact composition. Describe spatial layout precisely: where the person is, where product is, where text blocks are, logo placement, background scene, camera angle.",
              "If there is a human, say has_human=true and describe demographics neutral/professional (avoid sensitive speculation; describe visible attributes only).",
            ].join("\n"),
          },
          {
            inlineData: {
              data: source.buffer.toString("base64"),
              mimeType: source.mimeType,
            },
          },
        ],
      });

      const visionText =
        visionResponse.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";

      const source_image_analysis = z
        .object({
          has_human: z.boolean(),
          ocr_text: z.string().default(""),
          layout_description: z.string().min(1),
          subject_description: z.string().min(1),
          product_description: z.string().min(1),
          color_palette: z.string().min(1),
        })
        .parse(parseJsonObject(visionText));

      const step1 = step1LocalizeOutputSchema.parse({
        source_image: {
          mime_type: source.mimeType,
          image_base64: source.buffer.toString("base64"),
        },
        source_image_analysis,
        brand_context: {
          brand_id: inputData.input.brand_id,
          brand_dna: brandDna ?? undefined,
        },
      });

      const diagnostic = {
        step: "campaign-localize-step1-cultural-understanding",
        status: "ok" as const,
        duration_ms: Date.now() - startedAt,
        detail: {
          has_human: source_image_analysis.has_human,
          source_mime_type: source.mimeType,
        },
      };
      const diagnostics = appendInMemoryDiagnostic(inputData as Record<string, unknown>, diagnostic);
      await appendJobDiagnostic({
        jobId: inputData.job_id,
        diagnostic,
        phase: "campaign-localize-step1-cultural-understanding",
      });

      return { ...inputData, step1, diagnostics };
    } catch (error) {
      const diagnostic = {
        step: "campaign-localize-step1-cultural-understanding",
        status: "failed" as const,
        duration_ms: Date.now() - startedAt,
        detail: {
          error: error instanceof Error ? error.message : "step_failed",
        },
      };
      await appendJobDiagnostic({
        jobId: inputData.job_id,
        diagnostic,
        phase: "failed",
      });
      throw error;
    }
  },
});

