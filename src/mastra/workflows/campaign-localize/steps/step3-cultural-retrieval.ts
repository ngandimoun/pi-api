import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { retrieveLocalizedCampaignCorpusReference } from "@/lib/campaigns/retrieve-localized-campaign-reference";
import { appendInMemoryDiagnostic, appendJobDiagnostic } from "@/mastra/workflows/campaign-localize/diagnostics";
import { step3LocalizeOutputSchema } from "@/mastra/workflows/campaign-localize/schemas";

export const step3CulturalRetrieval = createStep({
  id: "campaign-localize-step3-cultural-retrieval",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const startedAt = Date.now();
    const brief = inputData.step2.localization_brief;
    const query = [brief.retrieval_query, ...(brief.keywords ?? [])].filter(Boolean).join("\n");

    try {
      const corpus = await retrieveLocalizedCampaignCorpusReference({
        query,
        filterCulture: brief.target_culture,
        requireHuman: Boolean(inputData.step1.source_image_analysis?.has_human),
      });

      const step3 = step3LocalizeOutputSchema.parse({
        corpus_row_id: corpus.row_id,
        corpus_master_prompt: corpus.master_prompt,
        corpus_image_url: corpus.image_url,
        corpus_mime_type: corpus.mime_type,
        corpus_image_base64: corpus.image_buffer.toString("base64"),
        corpus_metadata: corpus.metadata,
        corpus_similarity_score: corpus.similarity_score,
        retrieval_diagnostics: corpus.retrieval_diagnostics ?? {},
      });

      const diagnostic = {
        step: "campaign-localize-step3-cultural-retrieval",
        status: "ok" as const,
        duration_ms: Date.now() - startedAt,
        detail: {
          corpus_row_id: step3.corpus_row_id,
          corpus_image_url: step3.corpus_image_url,
          similarity_score: step3.corpus_similarity_score,
          retrieval_diagnostics: step3.retrieval_diagnostics,
        },
      };
      const diagnostics = appendInMemoryDiagnostic(inputData as Record<string, unknown>, diagnostic);
      await appendJobDiagnostic({
        jobId: inputData.job_id,
        diagnostic,
        phase: "campaign-localize-step3-cultural-retrieval",
      });

      return { ...inputData, step3, diagnostics };
    } catch (error) {
      const diagnostic = {
        step: "campaign-localize-step3-cultural-retrieval",
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

