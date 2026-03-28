import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getCampaignGeminiClient, getCampaignOrchestratorModelId } from "@/lib/campaigns/gemini-client";
import { appendInMemoryDiagnostic, appendJobDiagnostic } from "@/mastra/workflows/campaign-localize/diagnostics";
import { step4LocalizeOutputSchema } from "@/mastra/workflows/campaign-localize/schemas";

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

export const step4CulturalReasoning = createStep({
  id: "campaign-localize-step4-cultural-reasoning",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const startedAt = Date.now();
    const ai = getCampaignGeminiClient();
    const model = getCampaignOrchestratorModelId();

    try {
      const brief = inputData.step2.localization_brief;

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            text: [
              "Return ONLY one JSON object.",
              "Keys: structural_layout_map (string), keep (array), remove (array), add (array), cultural_replacements (array), composition_plan (string), style_notes (string), currency_format_notes (string), text_direction (string).",
              "",
              "You are localizing a marketing ad image into the target culture.",
              "CRITICAL: Preserve the exact structural layout from the SOURCE image (object positions, framing, and composition).",
              "Use the CORPUS image ONLY as a style reference for what ads look like in the target culture.",
              "",
              `TARGET_CULTURE: ${brief.target_culture}`,
              `TARGET_LANGUAGE: ${brief.target_language}`,
              `TARGET_CURRENCY: ${brief.target_currency}`,
              `LAYOUT_PRESERVATION: ${brief.layout_preservation_instructions}`,
              `CULTURAL_ADAPTATIONS: ${JSON.stringify(brief.cultural_adaptations ?? [])}`,
              `TEXT_TRANSLATIONS: ${JSON.stringify(brief.text_translations ?? [])}`,
              `SOURCE_IMAGE_ANALYSIS: ${JSON.stringify(inputData.step1.source_image_analysis)}`,
              `CORPUS_METADATA: ${JSON.stringify(inputData.step3.corpus_metadata ?? {})}`,
              `CORPUS_MASTER_PROMPT: ${inputData.step3.corpus_master_prompt}`,
              "",
              "In structural_layout_map, write strict position constraints (e.g., 'Person stays center-left; cup stays in right hand; product stays bottom-right; headline stays top-left').",
              "In currency_format_notes, specify exact expected numeric separators and currency symbol/code usage for the locale.",
              "text_direction must be one of: LTR, RTL.",
            ].join("\n"),
          },
          // Source image first (composition anchor).
          {
            inlineData: {
              data: inputData.step1.source_image.image_base64,
              mimeType: inputData.step1.source_image.mime_type,
            },
          },
          // Cultural corpus reference second.
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

      const step4 = step4LocalizeOutputSchema.parse(
        z
          .object({
            structural_layout_map: z.string().min(1),
            keep: z.array(z.string().min(1)).default([]),
            remove: z.array(z.string().min(1)).default([]),
            add: z.array(z.string().min(1)).default([]),
            cultural_replacements: z.array(z.string().min(1)).default([]),
            composition_plan: z.string().min(1),
            style_notes: z.string().min(1),
            currency_format_notes: z.string().min(1).default(""),
            text_direction: z.string().min(1).default("LTR"),
          })
          .parse(parsed)
      );

      const diagnostic = {
        step: "campaign-localize-step4-cultural-reasoning",
        status: "ok" as const,
        duration_ms: Date.now() - startedAt,
        detail: {
          keep_count: step4.keep.length,
          remove_count: step4.remove.length,
          add_count: step4.add.length,
          text_direction: step4.text_direction,
        },
      };
      const diagnostics = appendInMemoryDiagnostic(inputData as Record<string, unknown>, diagnostic);
      await appendJobDiagnostic({
        jobId: inputData.job_id,
        diagnostic,
        phase: "campaign-localize-step4-cultural-reasoning",
      });

      return { ...inputData, step4, diagnostics };
    } catch (error) {
      const diagnostic = {
        step: "campaign-localize-step4-cultural-reasoning",
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

