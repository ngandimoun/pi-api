BEGIN;

CREATE TABLE IF NOT EXISTS public.projected_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  developer_id text NOT NULL,
  use_case text NOT NULL,
  is_wildcard boolean NOT NULL DEFAULT true,
  clean_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projected_payloads_org_created
  ON public.projected_payloads (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projected_payloads_use_case_created
  ON public.projected_payloads (use_case, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projected_payloads_developer_created
  ON public.projected_payloads (developer_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_projected_payloads_set_updated_at ON public.projected_payloads;
CREATE TRIGGER trg_projected_payloads_set_updated_at
BEFORE UPDATE ON public.projected_payloads
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
