-- Allow authenticated users to insert their own public.users row when the auth trigger
-- did not run (e.g. legacy account or trigger missing). Required for dashboard + API routes
-- that upsert profile rows using the user's JWT.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile" ON public.users
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;
