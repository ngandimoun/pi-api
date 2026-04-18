# Pi API + Mastra — production monitoring

Use this checklist with **Vercel**, **Supabase**, **Trigger.dev**, **Unkey**, **Stripe webhooks**, and your log vendor (Datadog, Axiom, etc.). Operational playbooks: [`architecture/operations-runbook.md`](../../architecture/operations-runbook.md).

## Uptime and readiness

| Signal | Source | Suggested action |
|--------|--------|------------------|
| `GET /api/health` returns `200` and `ok: true` | Vercel Cron (`/api/cron/health-alert`) or external uptime | Page if `ok: false` or non-200 for 2+ consecutive checks. Stricter than CLI health (requires Unkey root + Stripe webhook secret). |
| `GET /api/cli/health` returns `200` and `ok: true` | Local `pi doctor`, CI preflight | Page if `ok: false` in environments that depend on Mastra workflows. |
| `checks.postgres.reachable` | Both health payloads | Page on `false` (password, pooler, or network) |
| `checks.postgres.memory_table` | `/api/health` / `/api/cli/health` | Track `message_count` and `oldest_message_age_seconds` for retention / growth |
| `checks.workflow_mode.enabled` | Same | Warn if flipped off in Production |
| `checks.trigger_dev.configured` | Same | Warn if async paths cannot dispatch |
| `checks.unkey.reachable` | `/api/health` only | Page on `false` — API traffic cannot authenticate |
| `checks.stripe.webhook_secret_configured` | `/api/health` only | Page on `false` in Production — subscription → Unkey sync will break |

### Cron alerting

- Configure `ALERT_WEBHOOK_URL` (Slack incoming webhook, PagerDuty, etc.).
- Set `CRON_SECRET` in Vercel; the platform sends `Authorization: Bearer <CRON_SECRET>` to cron routes.
- Cron path: `GET /api/cron/health-alert` (see `vercel.json`). On failure it POSTs a short JSON payload to `ALERT_WEBHOOK_URL`.

## Application logs (Next.js / Vercel Functions)

| Pattern | Meaning |
|---------|---------|
| `[mastra-storage] PostgresStore constructor failed` | Storage init broken — check URL, SSL, schema |
| `[mastra-storage] WARN: unverified TLS is deprecated` | `PI_CLI_DATABASE_SSL_REJECT_UNAUTHORIZED=false` in production — migrate to `PI_CLI_DATABASE_CA_BUNDLE` or fix trust chain |
| `[pi-cli/validate] async_trigger_failed` | Trigger.dev dispatch failure — check `TRIGGER_SECRET_KEY`, project ref, worker |
| `[pi-cli/validate] workflow_non_success` | Mastra run ended not `success` — inspect run via `POST /api/cli/trace` |
| `workflow_unavailable` / `workflow_disabled` in API responses | Fail-closed or misconfiguration — correlate with health |

## Mastra workflows (all registered ids)

Workflows are registered in [`src/mastra/index.ts`](../../src/mastra/index.ts). Each maps to one **quota family** for Unkey monthly limits (see `src/lib/workflow-family.ts`).

| Workflow id | Family | Typical entry |
|-------------|--------|----------------|
| `uppercaseWorkflow` | `cli` | demos / tests |
| `campaignAdsWorkflow`, `campaignLocalizeWorkflow` | `brand` | `/api/v1/campaigns/*`, `/api/v1/ads/*` |
| `healthTriageWorkflow`, `neuroDecodeWorkflow`, `cognitiveWellnessWorkflow`, `patientRiskWorkflow`, `adherenceWorkflow`, `notesStructureWorkflow`, `decisionSupportWorkflow`, `medicationCheckWorkflow`, `scanAnalysisWorkflow`, `researchAssistWorkflow` | `health` | `/api/v1/health/*`, `/api/v1/neuro/*` |
| `surveillanceStreamWorkflow` | `surveillance` | `/api/v1/surveillance/*`, Trigger `surveillance-stream-analyzer` |
| `robotRunWorkflow` | `robotics` | `/api/v1/robots/*`, Trigger `robot-run-analyzer` |
| `cliValidateWorkflow`, `cliRoutineWorkflow`, `cliLearnWorkflow`, `cliGraphBuilderWorkflow`, `cliAdaptiveEngineWorkflow`, `cliGithubPrCheckWorkflow`, `cliResonateWorkflow` | `cli` | `/api/cli/*`, Pi CLI Hokage |

## Trigger.dev

| Metric | Suggestion |
|--------|------------|
| Failed runs for task `cli-workflow-runner` | Alert on error rate spike |
| Failed runs for `surveillance-stream-analyzer`, `robot-run-analyzer` | Same — domain pipelines |
| Queue wait time | Scale workers or reduce burst from CLI |
| Run duration p95 | Detect slow Gemini / Postgres steps |

## Supabase (Postgres)

| Metric | Suggestion |
|--------|------------|
| Connection pool saturation (transaction pooler) | **Alert ~70%** of max connections; raise pool size or reduce concurrent serverless invocations |
| Disk / IO | Mastra + pgvector growth — use `mastra_retention_settings` + `mastra.prune_expired_conversations()` (migration `0019_mastra_memory_retention.sql`) |
| Auth failures | Often wrong `PI_CLI_DATABASE_URL` password — see health `checks.postgres.error` |

## Unkey (per-family quotas)

- Limits are attached per API key at creation / Stripe sync (`src/lib/unkey.ts`, `src/lib/unkey-user-sync.ts`).
- Each `/api/v1/*` request consumes **`cli_requests_monthly`** plus the path family bucket (`health_monthly`, `brand_monthly`, …) via `verifyKey` explicit `ratelimits` (`src/lib/auth.ts`).
- Dashboard: plan matrix per tier in [`src/lib/pi-cli-plan-limits.ts`](../../src/lib/pi-cli-plan-limits.ts); live remaining counts are authoritative in **Unkey** for non-CLI traffic.

## Automated checks in CI

- `npx vitest run tests/mastra/mastra-registry.test.ts tests/mastra/mastra-architect-tools.test.ts` — registry parity (no live services).
- `npm run verify:mastra-hokage` — optional job with `PI_BASE_URL` pointing at Preview/Production and secrets for Phase B (see `scripts/mastra-hokage-verify.mjs`).
- `npm run verify:mastra-schema` — optional job with `PI_CLI_DATABASE_URL` (read-only DB user recommended for CI if you split roles later).
