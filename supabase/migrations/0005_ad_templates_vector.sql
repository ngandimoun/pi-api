BEGIN;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Drop the old table if you created it, we are upgrading.
DROP TABLE IF EXISTS public.ad_templates_vector CASCADE;

CREATE TABLE public.ad_templates_vector (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash text UNIQUE NOT NULL,
  master_prompt text NOT NULL,
  ai_description text NOT NULL,
  ocr_text text,
  quality_score int NOT NULL,
  aspect_ratio text NOT NULL,
  metadata jsonb NOT NULL,
  r2_image_url text NOT NULL,
  embedding extensions.vector(768)
);

CREATE INDEX idx_ad_templates_vector_embedding_hnsw
  ON public.ad_templates_vector
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_ad_templates_vector_metadata_gin
  ON public.ad_templates_vector
  USING gin (metadata);

CREATE UNIQUE INDEX idx_file_hash ON public.ad_templates_vector(file_hash);

-- The Localization-Aware Hybrid Search
CREATE OR REPLACE FUNCTION public.match_localized_ad_references(
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int,
  filter_industry text DEFAULT NULL,
  filter_culture text DEFAULT NULL,
  require_human boolean DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  master_prompt text,
  r2_image_url text,
  metadata jsonb,
  similarity float,
  quality_score int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.master_prompt,
    v.r2_image_url,
    v.metadata,
    1 - (v.embedding <=> query_embedding) AS similarity,
    v.quality_score
  FROM public.ad_templates_vector v
  WHERE 1 - (v.embedding <=> query_embedding) > match_threshold
    AND (filter_industry IS NULL OR v.metadata->>'industry' = filter_industry)
    AND (filter_culture IS NULL OR v.metadata->'culture'->>'vibe' = filter_culture)
    AND (
      require_human IS NULL
      OR (v.metadata->'demographics'->>'has_human')::boolean = require_human
    )
  ORDER BY (1 - (v.embedding <=> query_embedding)) * (v.quality_score / 10.0) DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
