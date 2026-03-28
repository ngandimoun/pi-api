import type { Json } from "@/types/database";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { getCampaignGeminiClient } from "@/lib/campaigns/gemini-client";

function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 10);
}

function metadataSignal(metadata: Record<string, unknown>, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const haystack = JSON.stringify(metadata ?? {}).toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 0.01;
  }
  return Math.min(0.1, score);
}

function getCultureVibe(metadata: Record<string, unknown>): string | null {
  const culture = metadata.culture;
  if (!culture || typeof culture !== "object" || Array.isArray(culture)) return null;
  const vibe = (culture as Record<string, unknown>).vibe;
  return typeof vibe === "string" && vibe.trim() ? vibe.trim() : null;
}

function getHasHuman(metadata: Record<string, unknown>): boolean | null {
  const demographics = metadata.demographics;
  if (!demographics || typeof demographics !== "object" || Array.isArray(demographics)) return null;
  const hasHuman = (demographics as Record<string, unknown>).has_human;
  return typeof hasHuman === "boolean" ? hasHuman : null;
}

export class CampaignLocalizedCorpusNotFoundError extends Error {
  readonly code = "retrieval_failed" as const;
  constructor(message: string) {
    super(message);
    this.name = "CampaignLocalizedCorpusNotFoundError";
  }
}

type RpcRow = {
  id: string;
  master_prompt: string;
  r2_image_url: string;
  metadata: Json;
  similarity: number;
  quality_score: number;
  combined_score: number;
  tier: string;
};

type HybridRow = {
  id: string;
  master_prompt: string;
  ai_description: string;
  r2_image_url: string;
  metadata: Json;
  quality_score: number;
};

export type CampaignLocalizedCorpusReference = {
  row_id: string;
  master_prompt: string;
  image_url: string;
  metadata: Record<string, unknown>;
  similarity_score: number;
  mime_type: string;
  image_buffer: Buffer;
  retrieval_diagnostics: Record<string, unknown>;
};

/**
 * Retrieve a culturally-biased reference image from the global ad corpus.
 *
 * NOTE: The SQL RPC uses tiered fallback that may relax culture/human requirements.
 * For the Localizer product, we enforce strict matches in code:
 * - If `filterCulture` is provided, metadata.culture.vibe must equal it.
 * - If `requireHuman === true`, metadata.demographics.has_human must be true.
 */
export async function retrieveLocalizedCampaignCorpusReference(params: {
  query: string;
  filterCulture: string;
  requireHuman: boolean;
}): Promise<CampaignLocalizedCorpusReference> {
  const ai = getCampaignGeminiClient();
  const embedResult = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: params.query.trim(),
    config: { outputDimensionality: 768 },
  });

  const values = embedResult.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Embedding service returned no vector.");
  }

  const supabase = getServiceSupabaseClient();
  const tokens = tokenize(params.query);

  const attempt = async (matchThreshold: number) => {
    const { data: rpcData, error: rpcError } = await supabase.rpc("match_localized_ad_references_v2", {
      query_embedding: toPgVector(values),
      match_threshold: matchThreshold,
      match_count: 24,
      filter_industry: null,
      filter_culture: params.filterCulture,
      require_human: params.requireHuman ? true : null,
    });

    if (rpcError) {
      throw new Error(`Reference lookup failed: ${rpcError.message}`);
    }

    const likeToken = tokens[0] ?? "";
    const query = supabase
      .from("ad_templates_vector")
      .select("id,master_prompt,ai_description,r2_image_url,metadata,quality_score")
      .limit(24);

    // Hybrid rows are filtered strictly as well (culture + human) to avoid accidental tier relax.
    const baseHybrid = likeToken
      ? query.or(`master_prompt.ilike.%${likeToken}%,ai_description.ilike.%${likeToken}%`)
      : query;

    const { data: hybridRows, error: hybridError } = await baseHybrid;
    if (hybridError) {
      throw new Error(`Hybrid lookup failed: ${hybridError.message}`);
    }

    const merged = new Map<string, { row: RpcRow | HybridRow; score: number; source: string }>();

    for (const row of (rpcData ?? []) as RpcRow[]) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      if (params.filterCulture && getCultureVibe(meta) !== params.filterCulture) continue;
      if (params.requireHuman && getHasHuman(meta) !== true) continue;

      const quality = Math.max(0, Math.min(1, Number(row.quality_score ?? 0) / 10));
      const metaBoost = metadataSignal(meta, tokens);
      const score = Number(row.similarity ?? 0) * 0.72 + quality * 0.22 + metaBoost;
      merged.set(row.id, { row, score, source: "rpc" });
    }

    for (const row of (hybridRows ?? []) as HybridRow[]) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      if (params.filterCulture && getCultureVibe(meta) !== params.filterCulture) continue;
      if (params.requireHuman && getHasHuman(meta) !== true) continue;

      const text = `${row.master_prompt} ${row.ai_description}`.toLowerCase();
      const tokenHits = tokens.filter((t) => text.includes(t)).length;
      const lexicalScore = tokens.length > 0 ? tokenHits / tokens.length : 0;
      const quality = Math.max(0, Math.min(1, Number(row.quality_score ?? 0) / 10));
      const metaBoost = metadataSignal(meta, tokens);
      const score = lexicalScore * 0.65 + quality * 0.25 + metaBoost;
      const existing = merged.get(row.id);
      if (!existing || score > existing.score) {
        merged.set(row.id, { row, score, source: "hybrid" });
      }
    }

    const ranked = [...merged.values()].sort((a, b) => b.score - a.score);
    for (const item of ranked) {
      const imageUrl = (item.row as any).r2_image_url as string | undefined;
      if (!imageUrl) continue;

      const response = await fetch(imageUrl);
      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) continue;

      const mimeType =
        response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "image/jpeg";

      const meta = ((item.row as any).metadata ?? {}) as Record<string, unknown>;

      return {
        row_id: String((item.row as any).id),
        master_prompt: String((item.row as any).master_prompt),
        image_url: imageUrl,
        metadata: meta,
        similarity_score: item.score,
        mime_type: mimeType,
        image_buffer: buffer,
        retrieval_diagnostics: {
          match_threshold: matchThreshold,
          filter_culture: params.filterCulture,
          require_human: params.requireHuman,
          rank_source: item.source,
        },
      };
    }

    return null;
  };

  const result = (await attempt(0.22)) ?? (await attempt(0.15));
  if (result) return result;

  throw new CampaignLocalizedCorpusNotFoundError(
    "No culture-matching corpus image reference returned by localized retrieval."
  );
}

