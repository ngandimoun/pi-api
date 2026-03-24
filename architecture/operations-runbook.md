# Operations runbook (Pi API)

Short operational reference for keys, database, workers, smoke checks, and observability. Deep architecture lives alongside in this folder.

## Reusing E2E / brand fixtures (save extraction cost)

- Canonical snapshot and copy-paste ids: [`artifacts/README.md`](../artifacts/README.md).
- Use it when building new APIs or running `projection:golden-check` so `PROJECTION_GOLDEN_BRAND_ID` matches a known `brand_dna` already in your DB — **avoid** running a full extract again unless you need a fresh pipeline test.
- Do not rename the canonical JSON without updating `artifacts/README.md`.

## Unkey (API keys)

- Keys are verified on each `/api/v1/*` request via Unkey.
- Configure `UNKEY_ROOT_KEY`, `UNKEY_API_ID`, and related Unkey env vars in `.env.local` (see `.env.example`).
- Create or rotate keys in the [Unkey dashboard](https://unkey.dev) for your API; map `ownerId` / meta to your org model as in `scripts/projection-golden-check.mjs` (test keys) and production issuance flows.
- Never commit root keys; use CI secrets for deploy pipelines.

## Supabase (Postgres)

- Migrations live under `supabase/migrations/` (SQL files, e.g. `0001_initial_schema.sql` through `0004_projected_payloads.sql`).
- Apply with the Supabase CLI (`supabase db push` / linked project) or your team’s standard process; MCP-driven migration is optional if you use it in development.
- Service role access is via `getServiceSupabaseClient()` in app code — credentials from env.

## Trigger.dev (background jobs)

- Brand extraction and related work run as Trigger.dev tasks (`src/jobs/`, `trigger.config.ts`).
- Deploy workers with the Trigger.dev CLI / dashboard for your environment; ensure env matches the Next app (same Supabase, keys, model endpoints).
- Local: follow Trigger.dev docs for dev sessions if you run jobs against a dev project.

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

- No extra npm dependencies are required by this repo; wire your host’s logging (e.g. Vercel) or APM (Sentry, etc.) as you prefer.
- **Search:** `[dynamic_projection]` for projection-stage failures; `[brands.project]` for route-level projection errors.
- **HTTP:** alert on elevated **5xx** for `/api/v1/brands/*/project` and other v1 routes in production.
