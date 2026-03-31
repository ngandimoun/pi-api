-- Surveillance policies + incident log (SSE + history)

BEGIN;

CREATE TABLE IF NOT EXISTS public.surveillance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stream_id text NOT NULL DEFAULT '',
  name text NOT NULL,
  type text NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT surveillance_policies_org_stream_name_unique UNIQUE (org_id, stream_id, name)
);

CREATE TABLE IF NOT EXISTS public.surveillance_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stream_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surveillance_policies_org_id ON public.surveillance_policies(org_id);
CREATE INDEX IF NOT EXISTS idx_surveillance_policies_stream ON public.surveillance_policies(org_id, stream_id);
CREATE INDEX IF NOT EXISTS idx_surveillance_incidents_org_stream ON public.surveillance_incidents(org_id, stream_id);
CREATE INDEX IF NOT EXISTS idx_surveillance_incidents_created ON public.surveillance_incidents(created_at DESC);

DROP TRIGGER IF EXISTS trg_surveillance_policies_updated_at ON public.surveillance_policies;
CREATE TRIGGER trg_surveillance_policies_updated_at
BEFORE UPDATE ON public.surveillance_policies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
