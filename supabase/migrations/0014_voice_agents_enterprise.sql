BEGIN;

ALTER TABLE public.voice_agents
  ADD COLUMN IF NOT EXISTS output_schema_strict jsonb,
  ADD COLUMN IF NOT EXISTS extraction_model text;

COMMIT;
