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

export class CampaignCorpusNotFoundError extends Error {
  readonly code = "retrieval_failed" as const;
  constructor(message: string) {
    super(message);
    this.name = "CampaignCorpusNotFoundError";
  }
}

type RpcRow = {
  id: string;
  master_prompt: string;
  r2_image_url: string;
  metadata: Json;
  similarity: number;
  quality_score: number;
};

type HybridRow = {
  id: string;
  master_prompt: string;
  ai_description: string;
  r2_image_url: string;
  metadata: Json;
  quality_score: number;
};

export type CampaignCorpusReference = {
  row_id: string;
  master_prompt: string;
  image_url: string;
  metadata: Record<string, unknown>;
  similarity_score: number;
  mime_type: string;
  image_buffer: Buffer;
};

export async function retrieveCampaignCorpusReference(summary: string): Promise<CampaignCorpusReference> {
  const ai = getCampaignGeminiClient();
  const embedResult = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: summary.trim(),
    config: { outputDimensionality: 768 },
  });

  const values = embedResult.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Embedding service returned no vector.");
  }

  const supabase = getServiceSupabaseClient();
  const matchCount = 16;
  const matchThreshold = 0.22;

  const { data: rpcData, error: rpcError } = await supabase.rpc("match_localized_ad_references_v2", {
    query_embedding: toPgVector(values),
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_industry: null,
    filter_culture: null,
    require_human: null,
  });

  if (rpcError) {
    throw new Error(`Reference lookup failed: ${rpcError.message}`);
  }

  const tokens = tokenize(summary);
  const likeToken = tokens[0] ?? "";
  const query = supabase
    .from("ad_templates_vector")
    .select("id,master_prompt,ai_description,r2_image_url,metadata,quality_score")
    .limit(16);

  const { data: hybridRows, error: hybridError } = likeToken
    ? await query.or(`master_prompt.ilike.%${likeToken}%,ai_description.ilike.%${likeToken}%`)
    : await query;

  if (hybridError) {
    throw new Error(`Hybrid lookup failed: ${hybridError.message}`);
  }

  const merged = new Map<string, { row: RpcRow | HybridRow; score: number }>();

  for (const row of (rpcData ?? []) as RpcRow[]) {
    const quality = Math.max(0, Math.min(1, Number(row.quality_score ?? 0) / 10));
    const meta = metadataSignal((row.metadata ?? {}) as Record<string, unknown>, tokens);
    const score = Number(row.similarity ?? 0) * 0.72 + quality * 0.22 + meta;
    merged.set(row.id, { row, score });
  }

  for (const row of (hybridRows ?? []) as HybridRow[]) {
    const text = `${row.master_prompt} ${row.ai_description}`.toLowerCase();
    const tokenHits = tokens.filter((t) => text.includes(t)).length;
    const lexicalScore = tokens.length > 0 ? tokenHits / tokens.length : 0;
    const quality = Math.max(0, Math.min(1, Number(row.quality_score ?? 0) / 10));
    const meta = metadataSignal((row.metadata ?? {}) as Record<string, unknown>, tokens);
    const score = lexicalScore * 0.65 + quality * 0.25 + meta;
    const existing = merged.get(row.id);
    if (!existing || score > existing.score) {
      merged.set(row.id, { row, score });
    }
  }

  const ranked = [...merged.values()].sort((a, b) => b.score - a.score);
  for (const item of ranked) {
    const imageUrl = item.row.r2_image_url;
    if (!imageUrl) continue;

    const response = await fetch(imageUrl);
    if (!response.ok) continue;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) continue;

    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "image/jpeg";

    return {
      row_id: item.row.id,
      master_prompt: item.row.master_prompt,
      image_url: imageUrl,
      metadata: (item.row.metadata ?? {}) as Record<string, unknown>,
      similarity_score: item.score,
      mime_type: mimeType,
      image_buffer: buffer,
    };
  }

  throw new CampaignCorpusNotFoundError("No corpus image reference returned by hybrid retrieval.");
}
