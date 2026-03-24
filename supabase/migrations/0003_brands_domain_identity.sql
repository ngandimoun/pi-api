BEGIN;

ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS domain text;

UPDATE public.brands
SET domain = lower(regexp_replace(trim(name), '^www\.', ''))
WHERE domain IS NULL OR length(trim(domain)) = 0;

UPDATE public.brands
SET domain = id::text
WHERE domain IS NULL OR length(trim(domain)) = 0;

WITH ranked_domains AS (
  SELECT
    id,
    org_id,
    domain,
    row_number() OVER (PARTITION BY org_id, domain ORDER BY created_at, id) AS rn
  FROM public.brands
)
UPDATE public.brands b
SET domain = b.domain || '-' || right(b.id::text, 8)
FROM ranked_domains d
WHERE b.id = d.id
  AND d.rn > 1;

ALTER TABLE public.brands
ALTER COLUMN domain SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'brands_org_id_domain_unique'
  ) THEN
    ALTER TABLE public.brands
    ADD CONSTRAINT brands_org_id_domain_unique UNIQUE (org_id, domain);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_brands_domain ON public.brands(domain);

COMMIT;
