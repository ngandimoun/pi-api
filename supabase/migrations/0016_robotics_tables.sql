-- Robotics tables: robots, zones, behaviors, actions

BEGIN;

CREATE TABLE IF NOT EXISTS public.robots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  robot_id text NOT NULL,
  name text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  connection_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'offline',
  last_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT robots_org_robot_id_unique UNIQUE (org_id, robot_id)
);

CREATE TABLE IF NOT EXISTS public.robot_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  robot_id text NULL,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'custom',
  frame text NOT NULL DEFAULT 'map',
  polygon jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.robot_behaviors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  robot_id text NULL,
  name text NOT NULL,
  type text NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT robot_behaviors_org_robot_name_unique UNIQUE (org_id, robot_id, name)
);

CREATE TABLE IF NOT EXISTS public.robot_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  behavior_id uuid NULL REFERENCES public.robot_behaviors(id) ON DELETE CASCADE,
  on_type text NOT NULL,
  action_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_robots_org_id ON public.robots(org_id);
CREATE INDEX IF NOT EXISTS idx_robot_zones_org_id ON public.robot_zones(org_id);
CREATE INDEX IF NOT EXISTS idx_robot_zones_robot_id ON public.robot_zones(org_id, robot_id);
CREATE INDEX IF NOT EXISTS idx_robot_behaviors_org_id ON public.robot_behaviors(org_id);
CREATE INDEX IF NOT EXISTS idx_robot_behaviors_robot_id ON public.robot_behaviors(org_id, robot_id);
CREATE INDEX IF NOT EXISTS idx_robot_actions_org_id ON public.robot_actions(org_id);
CREATE INDEX IF NOT EXISTS idx_robot_actions_behavior_id ON public.robot_actions(behavior_id);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_robots_updated_at ON public.robots;
CREATE TRIGGER trg_robots_updated_at
BEFORE UPDATE ON public.robots
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_robot_zones_updated_at ON public.robot_zones;
CREATE TRIGGER trg_robot_zones_updated_at
BEFORE UPDATE ON public.robot_zones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_robot_behaviors_updated_at ON public.robot_behaviors;
CREATE TRIGGER trg_robot_behaviors_updated_at
BEFORE UPDATE ON public.robot_behaviors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_robot_actions_updated_at ON public.robot_actions;
CREATE TRIGGER trg_robot_actions_updated_at
BEFORE UPDATE ON public.robot_actions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

