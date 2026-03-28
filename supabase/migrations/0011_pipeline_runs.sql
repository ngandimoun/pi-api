BEGIN;

CREATE TABLE IF NOT EXISTS public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_runs_org_created_at ON public.runs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON public.runs (status);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_step_id text;

CREATE INDEX IF NOT EXISTS idx_jobs_run_id ON public.jobs (run_id);

COMMIT;
