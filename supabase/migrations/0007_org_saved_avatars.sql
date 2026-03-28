BEGIN;

CREATE TABLE IF NOT EXISTS public.org_saved_avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text,
  image_url text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_saved_avatars_org_id ON public.org_saved_avatars(org_id);
CREATE INDEX IF NOT EXISTS idx_org_saved_avatars_org_created ON public.org_saved_avatars(org_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_org_saved_avatars_set_updated_at ON public.org_saved_avatars;
CREATE TRIGGER trg_org_saved_avatars_set_updated_at
BEFORE UPDATE ON public.org_saved_avatars
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.org_saved_avatars ENABLE ROW LEVEL SECURITY;

COMMIT;
