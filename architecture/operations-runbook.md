# Operations runbook (Pi API)

Short operational reference for keys, database, workers, smoke checks, and observability. Deep architecture lives alongside in this folder.

For **Mastra / Postgres / Trigger / Vercel alert wiring**, see also [`docs/cli/mastra-monitoring.md`](../docs/cli/mastra-monitoring.md).

## Reusing E2E / brand fixtures (save extraction cost)

- Canonical snapshot and copy-paste ids: [`artifacts/README.md`](../artifacts/README.md).
- Use it when building new APIs or running `projection:golden-check` so `PROJECTION_GOLDEN_BRAND_ID` matches a known `brand_dna` already in your DB — **avoid** running a full extract again unless you need a fresh pipeline test.
- Do not rename the canonical JSON without updating `artifacts/README.md`.

## Unkey (API keys)

- Keys are verified on each `/api/v1/*` request via Unkey (see `src/lib/auth.ts`, `src/lib/unkey.ts`).
- Configure `UNKEY_ROOT_KEY`, `UNKEY_API_ID`, and related Unkey env vars in `.env.local` (see `.env.example`).
- Create or rotate keys in the [Unkey dashboard](https://unkey.dev) for your API; map `externalId` / meta to your org model as in `scripts/projection-golden-check.mjs` (test keys) and production issuance flows.
- Never commit root keys; use CI secrets for deploy pipelines.

### Rotate `UNKEY_ROOT_KEY` (emergency)

1. Create a new root key in the Unkey workspace (least privilege: only the APIs you need).
2. Update `UNKEY_ROOT_KEY` in Vercel (Production + Preview) and local `.env.local`.
3. Redeploy the Next app so all serverless instances pick up the new secret.
4. Revoke the old root key in Unkey after traffic is healthy (verify with `GET /api/health` and a sample `GET /api/v1/brands` with a test key).

### Revoke a leaked Pi API key

1. In Unkey dashboard: find the key by prefix or metadata `organization_id`; **disable** or **delete** immediately.
2. In Supabase `public.api_keys`: set `revoked_at = now()` for the matching row (if you store keys there).
3. Rotate any downstream secrets that were exposed in the same leak.

### Temporarily bump / waive quotas for one org

1. Prefer: adjust the user’s `subscription_tier` in `public.users` and re-run Stripe reconciliation, or call `syncUnkeyKeysForUser` from an admin script with the desired tier (see `src/lib/unkey-user-sync.ts`).
2. Alternatively: in Unkey, edit the key’s named limits (`cli_requests_monthly`, `health_monthly`, …) for that `keyId` only; document the override in your ticket system and **revert** after the incident.

## Supabase (Postgres)

- Migrations live under `supabase/migrations/` (SQL files, e.g. `0001_initial_schema.sql` through `0019_mastra_memory_retention.sql`).
- Apply with the Supabase CLI (`supabase db push` / linked project) or your team’s standard process; MCP-driven migration is optional if you use it in development.
- Service role access is via `getServiceSupabaseClient()` in app code — credentials from env.

### Rotate pooler password and update `PI_CLI_DATABASE_URL` (minimal downtime)

1. In Supabase → Project Settings → Database: reset the **pooler** / DB password.
2. Update `PI_CLI_DATABASE_URL` (and `DATABASE_URL` if shared) in Vercel **without** stray quotes or `export` prefixes (see `.env.example` checklist).
3. Redeploy or wait for the next cold start: [`src/lib/mastra-storage.ts`](../src/lib/mastra-storage.ts) uses a **pool fingerprint** so warm Lambdas rebuild the pool after the URL/TLS mode changes.
4. Confirm `GET /api/cli/health` → `checks.postgres.reachable: true` and `checks.postgres.diagnostics` flags are clean.

### Connection pool saturation (transaction pooler)

- **Symptoms:** elevated latency, `timeout` on health Postgres ping, Supabase “too many connections”.
- **Mitigate:** reduce concurrent Vercel invocations / burst from CLI; scale Supabase pool size; ensure Mastra storage is not instantiated per-request in hot paths.
- **Dashboards:** Supabase → Reports → Database → Connections; alert at ~70% of pool (see monitoring doc).

### Roll back a bad migration

1. **Never** delete applied migration files from git if they already ran in production; add a **forward-fix** migration instead.
2. For dev-only: restore from backup or `supabase db reset` (wipes data).
3. If a migration partially applied: use Supabase SQL editor to repair schema, then align `supabase_migrations.schema_migrations` under guidance from Supabase docs.

## TLS / Postgres SSL (Mastra)

- Prefer **verified TLS** (default). If you must trust a custom CA (corporate proxy), set `PI_CLI_DATABASE_CA_BUNDLE` (PEM) — see `.env.example` and [`src/lib/mastra-storage.ts`](../src/lib/mastra-storage.ts).
- `PI_CLI_DATABASE_SSL_REJECT_UNAUTHORIZED=false` is **deprecated** in production: it disables certificate verification. Remove after fixing the trust chain or CA bundle.

## Mastra (workflows + memory)

- Workflows are registered in [`src/mastra/index.ts`](../src/mastra/index.ts).
- **Diagnose `workflow_disabled` / `workflow_unavailable`:** correlate with `GET /api/cli/health` (`checks.workflow_mode`, `checks.postgres`, `PI_CLI_FAIL_CLOSED`). Log patterns: `workflow_non_available`, `[pi-cli/validate] workflow_non_success` (see monitoring doc).
- **Replay / inspect a run:** `POST /api/cli/trace` with the run payload your CLI uses (see `docs/cli/mastra-architecture.md`).

### Memory retention (TTL) and GDPR purge

- Default retention is driven by `mastra.mastra_retention_settings.ttl_days` (seed **90** in migration `0019_mastra_memory_retention.sql`). The app env `PI_MEMORY_TTL_DAYS` documents the intended policy; **align** with `UPDATE mastra.mastra_retention_settings SET ttl_days = … WHERE id = 1` when you change retention.
- **Manual purge for one org (CLI memory):** run a one-off script or SQL using the resource id pattern `pi_cli_org_<org>` (see `buildCliResourceId` in `src/lib/pi-cli-thread.ts`) and/or call the helper in `src/lib/pi-cli-memory-purge.ts` from an admin route you control.

## Trigger.dev (background jobs)

- Brand extraction and related work run as Trigger.dev tasks (`src/jobs/`, `trigger.config.ts`, `trigger.surveillance.config.ts`, `trigger.robotics.config.ts`).
- Deploy workers with the Trigger.dev CLI / dashboard for your environment; ensure env matches the Next app (same Supabase, keys, model endpoints).
- Local: follow Trigger.dev docs for dev sessions if you run jobs against a dev project.

### Drain / replay stuck jobs

1. Open Trigger.dev dashboard → filter failed runs for tasks such as `cli-workflow-runner`, `surveillance-stream-analyzer`, `robot-run-analyzer`.
2. Fix root cause (env, model, Postgres), then **replay** from the dashboard or re-dispatch from the originating API if idempotent.
3. If a run is wedged: cancel the run, fix data, retry from client.

## Stripe ↔ Unkey reconciliation

- **Symptom:** user paid in Stripe but API returns `DISABLED` / keys still off.
- **Checks:**
  1. Stripe customer metadata includes `user_id` matching `public.users.id` (webhook handler in `src/app/api/stripe/webhook/route.ts`).
  2. `public.users.subscription_status` is `active` or `trialing` (`src/lib/subscription.ts`).
  3. `public.api_keys` has non-null `unkey_key_id` for that user.
  4. Re-send subscription webhook from Stripe dashboard or call `syncUnkeyKeysForUser(userId, { subscriptionActive: true, tier })` from a secure admin path.

## Voice / LiveKit

- Transport and tokens: `src/lib/livekit/*`, `docs/integrations/livekit.md`.
- **Kill a stuck room:** use LiveKit Cloud or self-hosted **RoomService** `DeleteRoom` for the room name (see `src/lib/livekit/room-service.ts`).
- **Rotate LiveKit API key:** update `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (names per your env), redeploy, revoke old key in LiveKit console.

## Projection golden check

- Run: `npm run projection:golden-check` (requires a running API, usually `PI_BASE_URL=http://localhost:3000` and valid Unkey + test org).
- Output: `artifacts/projection-golden-check.json`.
- Interpret **`metrics`**: `deterministic_rate`, `non_llm_rate`, `p95_latency_ms`, `valid_json_rate`. Tune thresholds via `PROJECTION_GOLDEN_MAX_DETERMINISTIC_RATE`, `PROJECTION_GOLDEN_MAX_NON_LLM_RATE` / `PROJECTION_GOLDEN_MAX_FALLBACK_RATE`, `PROJECTION_GOLDEN_MAX_P95_MS` (see `docs/v1/intro.mdx` Deploy Checklist).
- Server logs: search for `[dynamic_projection]` when diagnosing model vs deterministic fallback.

## Firecrawl (ingestion)

- Run: `npm run firecrawl:check` before deploy (also wired in `predeploy`).
- Requires `FIRECRAWL_API_KEY` and network access.

## API versioning and envelopes

- New resources stay under `/api/v1/...` until a future major version.
- Success responses use `apiSuccess` (`id`, `object`, `status: "completed"`, `created_at`, `data`); errors use `apiError` (Stripe-style `error` object).

## Idempotency

- Documented as a goal for `POST` endpoints; **not yet implemented** on v1 routes. See `docs/v1/intro.mdx`.

## Pagination and list endpoints

- Reuse existing patterns: query params, `has_more`-style list envelopes where applicable, same error shape as other routes.

## OpenAPI (future)

- Contracts are Zod-first (`src/contracts/brand-api.ts`). Generating OpenAPI from Zod is optional follow-up (e.g. `zod-to-openapi`); not required for current MDX docs.

## Alerts and logs (recommended)

- Wire your host’s logging (e.g. Vercel) or APM (Sentry, etc.) as you prefer.
- **Cron failure webhook:** set `ALERT_WEBHOOK_URL` (Slack incoming webhook, PagerDuty, etc.); Vercel Cron hits `/api/cron/health-alert` (see `vercel.json`).
- **Search:** `[dynamic_projection]` for projection-stage failures; `[brands.project]` for route-level projection errors; `[mastra-storage]` for Postgres/TLS init.
- **HTTP:** alert on elevated **5xx** for `/api/v1/brands/*/project` and other v1 routes in production.
