BEGIN;

ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS brand_dna jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
