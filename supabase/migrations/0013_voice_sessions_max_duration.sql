BEGIN;

ALTER TABLE public.voice_sessions
  ADD COLUMN IF NOT EXISTS max_duration_seconds integer;

COMMIT;
