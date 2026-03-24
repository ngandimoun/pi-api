-- 0001_initial_schema.sql
-- Pi API enterprise foundation schema
-- Notes:
-- - UUID primary keys everywhere
-- - created_at / updated_at on all core tables
-- - pgvector for style reference embeddings
-- - cascading deletes from organizations to tenant-owned data

BEGIN;

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Required for vector(1536) embeddings
-- Supabase commonly installs extensions under `extensions` schema.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE public.job_status AS ENUM ('queued', 'processing', 'completed', 'failed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_tier') THEN
    CREATE TYPE public.billing_tier AS ENUM ('free', 'pro', 'enterprise');
  END IF;
END
$$;

-- Shared trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1) organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unkey_workspace_id text UNIQUE,
  billing_tier public.billing_tier NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) brands (Brand Brain)
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  primary_hex text,
  secondary_hex text,
  logo_url text,
  font_file_url text,
  layout_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) products (Bulk Catalog)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  sku text NOT NULL,
  original_image_url text,
  product_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_org_sku_unique UNIQUE (org_id, sku)
);

-- 4) style_references (Style RAG)
CREATE TABLE IF NOT EXISTS public.style_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  aesthetic_label text,
  embedding extensions.vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) jobs (Stateful Orchestration)
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_url text,
  error_log text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6) webhooks
CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant access/perf indexes
CREATE INDEX IF NOT EXISTS idx_brands_org_id ON public.brands(org_id);
CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(org_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_style_references_org_id ON public.style_references(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON public.jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON public.jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_webhooks_org_id ON public.webhooks(org_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_org_active ON public.webhooks(org_id, is_active);

-- Vector index for similarity search (RAG retrieval)
-- HNSW is preferred for production-grade recall/latency tradeoffs.
CREATE INDEX IF NOT EXISTS idx_style_references_embedding_hnsw
  ON public.style_references
  USING hnsw (embedding extensions.vector_cosine_ops);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_organizations_set_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_set_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_brands_set_updated_at ON public.brands;
CREATE TRIGGER trg_brands_set_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_set_updated_at ON public.products;
CREATE TRIGGER trg_products_set_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_style_references_set_updated_at ON public.style_references;
CREATE TRIGGER trg_style_references_set_updated_at
BEFORE UPDATE ON public.style_references
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_set_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_set_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_webhooks_set_updated_at ON public.webhooks;
CREATE TRIGGER trg_webhooks_set_updated_at
BEFORE UPDATE ON public.webhooks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
