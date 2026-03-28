import { GoogleGenAI } from "@google/genai";

import type { AdGenerationInput } from "@/contracts/ads-api";
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

export type AdCorpusReferenceRow = {
  id: string;
  master_prompt: string;
  r2_image_url: string;
  metadata: Record<string, unknown>;
  similarity: number;
  quality_score: number;
};

export type AdCorpusReferenceRowV2 = AdCorpusReferenceRow & {
  combined_score: number;
  tier: string;
  applied_filters: Record<string, unknown>;
};

export type AdCorpusReference = {
  row: AdCorpusReferenceRow;
  imageBytes: Buffer;
  mimeType: string;
};

export type RetrievalTier = "strict" | "relax_culture" | "relax_industry" | "relax_human" | "global";

export type RetrievalDiagnostics = {
  tier: RetrievalTier;
  match_threshold: number;
  match_count: number;
  candidates: Array<{
    id: string;
    similarity: number;
    quality_score: number;
    combined_score: number;
    tier: string;
  }>;
  selected_id: string | null;
  applied_filters?: Record<string, unknown> | null;
};

export class CorpusReferenceNotFoundError extends Error {
  readonly code = "retrieval_failed" as const;
  constructor(message: string) {
    super(message);
    this.name = "CorpusReferenceNotFoundError";
  }
}

function metadataSignal(metadata: Record<string, unknown>, inferredMarket: string | null): number {
  let score = 0;
  const market = inferredMarket?.toLowerCase().trim();
  if (market) {
    const metaString = JSON.stringify(metadata).toLowerCase();
    if (metaString.includes(market)) score += 0.08;
  }
  const textDensity = metadata.text_density;
  if (typeof textDensity === "string") {
    if (textDensity.toLowerCase().includes("medium")) score += 0.03;
    if (textDensity.toLowerCase().includes("high")) score += 0.01;
  }
  return score;
}

function combinedScore(row: AdCorpusReferenceRow, inferredMarket: string | null): number {
  const semantic = Number(row.similarity ?? 0);
  const quality = Math.max(0, Math.min(1, Number(row.quality_score ?? 0) / 10));
  const meta = metadataSignal(row.metadata ?? {}, inferredMarket);
  return semantic * 0.72 + quality * 0.22 + meta;
}

function getEmbedClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: readEnv("GEMINI_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  });
}

/**
 * Retrieves top corpus ad reference (image + prompt row) for prompt enrichment.
 */
export async function retrieveAdCorpusReference(
  input: AdGenerationInput,
  inferredMarket: string | null
): Promise<{ reference: AdCorpusReference; diagnostics: RetrievalDiagnostics }> {
  const ai = getEmbedClient();
  const embedText = `Static ad retrieval query: ${input.prompt}`.trim();
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
  const matchThreshold = 0.22;
  const matchCount = 16;

  const { data, error } = await supabase.rpc("match_localized_ad_references_v2", {
    query_embedding: toPgVector(values),
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_industry: null,
    filter_culture: inferredMarket,
    require_human: false,
  });

  if (error) {
    throw new Error(`Reference lookup failed: ${error.message}`);
  }

  const rows = (data ?? []) as AdCorpusReferenceRowV2[];
  const ranked = rows
    .map((row) => ({ row, score: combinedScore(row, inferredMarket) }))
    .sort((a, b) => b.score - a.score);

  const candidates = ranked.slice(0, 12).map((r) => ({
    id: r.row.id,
    similarity: r.row.similarity,
    quality_score: r.row.quality_score,
    combined_score: r.score,
    tier: r.row.tier,
  }));

  for (const candidate of ranked) {
    const selected = candidate.row;
    if (!selected?.r2_image_url) continue;

    const response = await fetch(selected.r2_image_url);
    if (!response.ok) {
      continue;
    }

    const imageBytes = Buffer.from(await response.arrayBuffer());
    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "image/jpeg";

    const tier = (selected.tier as RetrievalTier) ?? "global";

    return {
      reference: {
        row: selected,
        imageBytes,
        mimeType,
      },
      diagnostics: {
        tier,
        match_threshold: matchThreshold,
        match_count: matchCount,
        candidates,
        selected_id: selected.id ?? null,
        applied_filters: selected.applied_filters ?? null,
      },
    };
  }

  throw new CorpusReferenceNotFoundError("No corpus image reference returned by retrieval (v2).");
}

