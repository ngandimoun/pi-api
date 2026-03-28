-- Idempotency keys for POST requests (org-scoped).
-- Used to replay responses for safe retries from automation platforms.

CREATE TABLE IF NOT EXISTS public.idempotency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text NOT NULL,
  key_hash text NOT NULL,
  request_hash text NOT NULL,
  response_status int NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT idempotency_requests_unique UNIQUE (org_id, scope, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_requests_lookup
  ON public.idempotency_requests(org_id, scope, key_hash);

CREATE INDEX IF NOT EXISTS idx_idempotency_requests_expires_at
  ON public.idempotency_requests(expires_at);

ALTER TABLE public.idempotency_requests ENABLE ROW LEVEL SECURITY;
