-- Mastra memory retention: prune stale threads/messages/vectors/observational rows in schema `mastra`.
-- See docs/cli/mastra-architecture.md. Safe to run if Mastra tables do not exist yet
-- (function checks information_schema before DML).

CREATE SCHEMA IF NOT EXISTS mastra;

CREATE TABLE IF NOT EXISTS mastra.mastra_retention_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ttl_days integer NOT NULL DEFAULT 90,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mastra.mastra_retention_settings (id, ttl_days)
VALUES (1, 90)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION mastra.prune_expired_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mastra, public
AS $$
DECLARE
  ttl integer;
  r record;
  cutoff timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'mastra' AND table_name = 'mastra_threads'
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(ttl_days, 90) INTO ttl FROM mastra.mastra_retention_settings WHERE id = 1;
  IF ttl IS NULL OR ttl < 1 THEN
    ttl := 90;
  END IF;

  cutoff := now() - (ttl::text || ' days')::interval;

  DELETE FROM mastra.mastra_messages m
  USING mastra.mastra_threads t
  WHERE m.thread_id = t.id
    AND t."updatedAt" < cutoff;

  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'mastra'
      AND (tablename = 'memory_messages' OR tablename LIKE 'memory_messages_%')
  LOOP
    EXECUTE format(
      $f$
        DELETE FROM mastra.%I
        WHERE metadata->>'thread_id' IN (
          SELECT id FROM mastra.mastra_threads WHERE "updatedAt" < %L
        )
      $f$,
      r.tablename,
      cutoff
    );
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'mastra' AND table_name = 'mastra_observational_memory'
  ) THEN
    DELETE FROM mastra.mastra_observational_memory
    WHERE "updatedAt" < cutoff;
  END IF;

  DELETE FROM mastra.mastra_threads
  WHERE "updatedAt" < cutoff;
END;
$$;

REVOKE ALL ON FUNCTION mastra.prune_expired_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mastra.prune_expired_conversations() TO postgres, service_role;

COMMENT ON FUNCTION mastra.prune_expired_conversations IS
  'Deletes mastra_threads (and messages / vector rows / observational memory) older than mastra.mastra_retention_settings.ttl_days. Schedule with pg_cron or call from an admin job.';

-- Optional: enable pg_cron in Supabase Dashboard (Database → Extensions), then schedule:
-- SELECT cron.schedule('mastra-prune-memory', '0 4 * * *', 'SELECT mastra.prune_expired_conversations()');
