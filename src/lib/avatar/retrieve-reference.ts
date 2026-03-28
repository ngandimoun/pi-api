import { GoogleGenAI } from "@google/genai";

import type { AvatarGenerationInput } from "@/contracts/avatar-api";
import { getServiceSupabaseClient } from "@/lib/supabase";

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

export type CorpusReferenceRow = {
  id: string;
  master_prompt: string;
  r2_image_url: string;
  metadata: Record<string, unknown>;
  similarity: number;
  quality_score: number;
};

export type CorpusReferenceRowV2 = CorpusReferenceRow & {
  combined_score: number;
  tier: string;
  applied_filters: Record<string, unknown>;
};

export type CorpusReference = {
  row: CorpusReferenceRow;
  imageBytes: Buffer;
  mimeType: string;
};

function getEmbedClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: readEnv("GEMINI_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  });
}

/**
 * Embeds the user query and returns the top-1 match from ad_templates_vector (human required).
 */
export async function retrieveCorpusReference(
  input: AvatarGenerationInput
): Promise<CorpusReference | null> {
  const hintBlock = input.hints
    ? `\n${JSON.stringify(input.hints).slice(0, 2000)}`
    : "";
  const embedText = `Avatar reference search: ${input.prompt}${hintBlock}`.trim();

  const ai = getEmbedClient();
  const embedResult = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: embedText,
    config: { outputDimensionality: 768 },
  });
  const values = embedResult.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Embedding service returned no vector.");
  }

  const supabase = getServiceSupabaseClient();
  const filterIndustry =
    typeof input.hints?.filter_industry === "string"
      ? input.hints.filter_industry
      : null;
  const filterCulture =
    typeof input.hints?.filter_culture === "string" ? input.hints.filter_culture : null;

  const { data, error } = await supabase.rpc("match_localized_ad_references_v2", {
    query_embedding: toPgVector(values),
    match_threshold: 0.22,
    match_count: 12,
    filter_industry: filterIndustry,
    filter_culture: filterCulture,
    require_human: true,
  });

  if (error) {
    throw new Error(`Reference lookup failed: ${error.message}`);
  }
  const rows = (data ?? []) as CorpusReferenceRowV2[];

  for (const row of rows) {
    if (!row?.r2_image_url) continue;

    const res = await fetch(row.r2_image_url);
    if (!res.ok) continue;

    const arrayBuffer = await res.arrayBuffer();
    const imageBytes = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
    return {
      row,
      imageBytes,
      mimeType: contentType,
    };
  }

  return null;
}
