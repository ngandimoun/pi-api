-- Persistent artifact cache for high-volume orchestration (optional backend).
-- Used only when PI_ADS_CACHE_BACKEND=supabase.

CREATE TABLE IF NOT EXISTS public.ads_artifact_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  size_bytes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ads_artifact_cache_expires_at
  ON public.ads_artifact_cache(expires_at);

-- RLS enabled; service-role uses bypass. Do not expose this table via client-side queries.
ALTER TABLE public.ads_artifact_cache ENABLE ROW LEVEL SECURITY;

