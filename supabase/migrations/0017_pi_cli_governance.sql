-- Pi CLI governance: roles, audit log, resonate drafts (tech-lead approval)

CREATE TABLE IF NOT EXISTS public.pi_cli_developers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tech_lead', 'developer', 'viewer')),
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pi_cli_developers_org_idx ON public.pi_cli_developers (organization_id);

CREATE TABLE IF NOT EXISTS public.pi_cli_governance_log (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  developer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pi_cli_governance_log_org_idx ON public.pi_cli_governance_log (organization_id);

CREATE TABLE IF NOT EXISTS public.pi_cli_resonate_drafts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  developer_id TEXT NOT NULL,
  proposed_system_style JSONB NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS pi_cli_resonate_drafts_org_idx ON public.pi_cli_resonate_drafts (organization_id);

COMMENT ON TABLE public.pi_cli_developers IS 'Pi CLI role per API identity; used for learn/resonate governance.';
COMMENT ON TABLE public.pi_cli_governance_log IS 'Audit trail for Pi CLI mutations.';
COMMENT ON TABLE public.pi_cli_resonate_drafts IS 'Pending system-style changes from junior devs awaiting tech_lead approval.';
