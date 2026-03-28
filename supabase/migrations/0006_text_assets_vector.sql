BEGIN;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

DROP TABLE IF EXISTS public.text_assets_vector CASCADE;

CREATE TABLE public.text_assets_vector (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash text UNIQUE NOT NULL,
  source text NOT NULL, -- e.g. prompts_dataset | fonts_design
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  r2_url text NOT NULL,
  embedding extensions.vector(768)
);

CREATE INDEX idx_text_assets_vector_embedding_hnsw
  ON public.text_assets_vector
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_text_assets_vector_metadata_gin
  ON public.text_assets_vector
  USING gin (metadata);

CREATE UNIQUE INDEX idx_text_assets_vector_file_hash ON public.text_assets_vector(file_hash);

CREATE OR REPLACE FUNCTION public.match_text_assets(
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int,
  filter_source text DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  source text,
  title text,
  r2_url text,
  metadata jsonb,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.source,
    t.title,
    t.r2_url,
    t.metadata,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.text_assets_vector t
  WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
    AND (filter_source IS NULL OR t.source = filter_source)
  ORDER BY 1 - (t.embedding <=> query_embedding) DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
