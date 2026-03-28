import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { retrieveCampaignCorpusReference } from "@/lib/campaigns/retrieve-campaign-reference";
import { step3OutputSchema } from "@/mastra/workflows/campaign-ads/schemas";

export const step3Retrieval = createStep({
  id: "campaign-step3-retrieval",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const query = [inputData.step2.summary, inputData.step2.keywords.join(" ")].filter(Boolean).join("\n");
    const corpus = await retrieveCampaignCorpusReference(query);

    const step3 = step3OutputSchema.parse({
      corpus_row_id: corpus.row_id,
      corpus_master_prompt: corpus.master_prompt,
      corpus_image_url: corpus.image_url,
      corpus_mime_type: corpus.mime_type,
      corpus_image_base64: corpus.image_buffer.toString("base64"),
      corpus_metadata: corpus.metadata,
      corpus_similarity_score: corpus.similarity_score,
    });

    return { ...inputData, step3 };
  },
});
