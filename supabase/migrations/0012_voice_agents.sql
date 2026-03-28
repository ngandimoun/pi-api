BEGIN;

CREATE TABLE IF NOT EXISTS public.voice_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'en-US',
  purpose text,
  instructions text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  behaviors jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_instruction text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.voice_agents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired')),
  participant jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  livekit_room_name text NOT NULL,
  transcript jsonb,
  results jsonb,
  duration_seconds integer,
  error_log text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_voice_agents_org_created ON public.voice_agents (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_agents_org_active ON public.voice_agents (org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_org_created ON public.voice_sessions (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_agent ON public.voice_sessions (agent_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_room ON public.voice_sessions (livekit_room_name);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_org_status ON public.voice_sessions (org_id, status);

DROP TRIGGER IF EXISTS trg_voice_agents_set_updated_at ON public.voice_agents;
CREATE TRIGGER trg_voice_agents_set_updated_at
BEFORE UPDATE ON public.voice_agents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_voice_sessions_set_updated_at ON public.voice_sessions;
CREATE TRIGGER trg_voice_sessions_set_updated_at
BEFORE UPDATE ON public.voice_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
