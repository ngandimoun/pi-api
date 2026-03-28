import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getCampaignGeminiClient, getCampaignOrchestratorModelId } from "@/lib/campaigns/gemini-client";
import { appendInMemoryDiagnostic, appendJobDiagnostic } from "@/mastra/workflows/campaign-localize/diagnostics";
import { step2LocalizeOutputSchema } from "@/mastra/workflows/campaign-localize/schemas";

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

export const step2LocalizationSummary = createStep({
  id: "campaign-localize-step2-localization-summary",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const startedAt = Date.now();
    const ai = getCampaignGeminiClient();
    const model = getCampaignOrchestratorModelId();

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            text: [
              "Return ONLY one JSON object.",
              "Key: localization_brief (object).",
              "localization_brief keys:",
              "- target_culture (string)",
              "- target_language (string; infer if missing)",
              "- target_currency (string; infer if missing)",
              "- layout_preservation_instructions (string; must be explicit and strict)",
              "- cultural_adaptations (array of strings; concrete swaps)",
              "- text_translations (array of strings; map source text -> localized text and currency format)",
              "- retrieval_query (string; query to find culturally-matching ads in corpus)",
              "- keywords (array of strings)",
              "",
              `DEV_PROMPT: ${inputData.input.prompt}`,
              `TARGET_CULTURE: ${inputData.input.target_culture}`,
              `TARGET_LANGUAGE: ${inputData.input.target_language ?? ""}`,
              `TARGET_CURRENCY: ${inputData.input.target_currency ?? ""}`,
              `SOURCE_IMAGE_ANALYSIS: ${JSON.stringify(inputData.step1.source_image_analysis)}`,
              `BRAND_DNA: ${JSON.stringify(inputData.step1.brand_context?.brand_dna ?? null)}`,
              "",
              "You are localizing the source ad image into the target culture while preserving exact composition.",
              "The retrieval_query should describe the TARGET culture ad aesthetic (not the source).",
            ].join("\n"),
          },
        ],
      });

      const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
      const parsed = parseJsonObject(text);

      const step2 = step2LocalizeOutputSchema.parse(
        z
          .object({
            localization_brief: z.object({
              target_culture: z.string().min(1),
              target_language: z.string().min(1),
              target_currency: z.string().min(1),
              layout_preservation_instructions: z.string().min(1),
              cultural_adaptations: z.array(z.string().min(1)).default([]),
              text_translations: z.array(z.string().min(1)).default([]),
              retrieval_query: z.string().min(1),
              keywords: z.array(z.string().min(1)).max(24).default([]),
            }),
          })
          .parse(parsed)
      );

      const brief = step2.localization_brief;
      const diagnostic = {
        step: "campaign-localize-step2-localization-summary",
        status: "ok" as const,
        duration_ms: Date.now() - startedAt,
        detail: {
          target_culture: brief.target_culture,
          target_language: brief.target_language,
          target_currency: brief.target_currency,
          keywords_count: brief.keywords?.length ?? 0,
        },
      };
      const diagnostics = appendInMemoryDiagnostic(inputData as Record<string, unknown>, diagnostic);
      await appendJobDiagnostic({
        jobId: inputData.job_id,
        diagnostic,
        phase: "campaign-localize-step2-localization-summary",
      });

      return { ...inputData, step2, diagnostics };
    } catch (error) {
      const diagnostic = {
        step: "campaign-localize-step2-localization-summary",
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

