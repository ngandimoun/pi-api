# Pi CLI Mastra Architecture

This document describes how Pi CLI uses Mastra workflows, memory, and agents to provide deterministic orchestration with optional human approval gates.

## Goals

- Keep CLI behavior predictable and auditable.
- Reduce repeated LLM context costs with thread-aware memory.
- Preserve a legacy fallback path when workflow mode is disabled.

## Feature Flags

- `PI_CLI_USE_WORKFLOWS=true`: enables workflow execution paths for CLI routes.
- `PI_CLI_ROUTINE_HITL=true`: enables suspend/resume approval flow for routine generation.
- `PI_CLI_ENABLE_MEMORY=true`: enables Mastra memory integration when Postgres is configured.
- `PI_CLI_DATABASE_URL` (or `DATABASE_URL`): required for Postgres-backed workflow/memory storage.
- `PI_MASTRA_DEFAULT_MODEL`: default Mastra model identifier.
- `PI_CLI_FAIL_CLOSED=true`: strict-mode default — when a workflow is requested but unavailable or failing, routes return `503 workflow_unavailable` / `503 workflow_disabled` instead of silently falling back to the legacy Gemini path. See the **Strict (fail-closed) mode** section below for per-request overrides.
- `PI_CLI_ASYNC=true` (CLI process env): `packages/pi-cli` sends `?async=true` on learn/validate/routine unless overridden per call.
- `PI_CLI_UPSTASH_REDIS_REST_URL` / `PI_CLI_UPSTASH_REDIS_REST_TOKEN` (or standard `UPSTASH_*`): optional L3 cache for validate responses.
- `R2_PI_GRAPHS_BUCKET`: optional; defaults to `R2_BUCKET_NAME` for dependency graph JSON in R2.

## Production readiness (Hokage edition)

The server-side Mastra stack is fully production-ready when every box below is ticked.

### Vercel environment (Production scope)

Set these on the `piii` project (Vercel → Settings → Environment Variables → **Production**). Preview/Dev may keep workflow mode off for soft bring-up.

| Variable | Value | Why |
| --- | --- | --- |
| `PI_MASTRA_DEFAULT_MODEL` | `google/gemini-3.1-pro-preview-customtools` | Unblocks `register()` in `src/instrumentation.ts`; used by all Mastra agents |
| `PI_CLI_DATABASE_URL` | `postgres://postgres.<ref>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?schema=mastra` | Mastra `PostgresStore` + `PgVector`; use the **Supabase transaction pooler** (short-lived Vercel functions) |
| `PI_CLI_USE_WORKFLOWS` | `true` | Turns on workflow paths in validate/learn/routine/resonate |
| `PI_CLI_ROUTINE_HITL` | `true` | Enables suspend/resume approval for `pi routine --approval` |
| `PI_CLI_ENABLE_MEMORY` | `true` | Thread-scoped memory + (optional) semantic recall |
| `PI_CLI_FAIL_CLOSED` | `true` | Return 503 instead of silent fallback when workflow unavailable |

Already present and kept as-is: `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini + embeddings), `TRIGGER_SECRET_KEY` / `TRIGGER_PROJECT_REF` (async workflow runner), Supabase, Stripe, Unkey.

### Supabase one-time setup

Run once in the Supabase SQL editor for project `ajxgpqoadkqjhirqrdbr`:

```sql
create schema if not exists mastra;
create extension if not exists vector;                     -- for PgVector memory
grant usage on schema mastra to postgres, service_role;
grant all privileges on schema mastra to postgres, service_role;
alter default privileges in schema mastra grant all on tables to postgres, service_role;
alter default privileges in schema mastra grant all on sequences to postgres, service_role;
alter default privileges in schema mastra grant all on functions to postgres, service_role;
```

`@mastra/pg`'s `PostgresStore` and `PgVector` auto-create their tables in the `mastra` schema on first request. No application-side migrations needed.

### Health probe — `GET /api/cli/health`

Unauthenticated readiness endpoint (no secrets leaked — returns only booleans). Used by uptime monitors, `pi doctor`, and CI preflight.

```bash
curl https://piii-black.vercel.app/api/cli/health
```

Returns `200` when `ok: true` (all critical checks green), otherwise `503` with the failing checks listed. Shape:

```json
{
  "object": "pi_cli_health",
  "ok": true,
  "checks": {
    "default_model":  { "configured": true, "source": "env" },
    "postgres":       { "configured": true, "reachable": true },
    "workflow_mode":  { "enabled": true },
    "routine_hitl":   { "enabled": true },
    "memory":         { "enabled": true, "semantic_recall": true },
    "trigger_dev":    { "configured": true },
    "gemini":         { "configured": true },
    "fail_closed":    { "enabled": true },
    "instrumentation_ok": true
  },
  "workflows": ["cliValidateWorkflow", "cliRoutineWorkflow", "cliLearnWorkflow", ...],
  "agents":    ["cliEnforcerAgent", "cliResonateAgent", "cliArchitectAgent"]
}
```

`ok === true` iff `default_model.configured && postgres.reachable && workflow_mode.enabled && gemini.configured`.

When Postgres is not reachable, `checks.postgres.diagnostics` includes:

- `env_source`: `"PI_CLI_DATABASE_URL"` \| `"DATABASE_URL"` \| `"none"` (which variable was read; never the value).
- `flags`: secret-safe booleans (`scheme_ok`, `length_ok`, `whatwg_url_ok`, `pg_parse_ok`, `regex_fallback_ok`, `has_placeholder`, `angle_template`, `hostname_is_base`, etc.) so you can see why `normalized_ok` is false without opening Vercel logs.

**Vercel paste checklist for `PI_CLI_DATABASE_URL`**

- Paste the URI only — no `export PI_CLI_DATABASE_URL=`, no surrounding `"` / `'`.
- Percent-encode reserved characters in the password: `@ : / ? # [ ] %`.
- Prefer the Supabase **transaction** pooler (`:6543`) and `?sslmode=require` (often added automatically by our canonicalizer for `*.pooler.supabase.com`).
- Save env vars for the correct scope (Production vs Preview), then **redeploy**.

### Strict (fail-closed) mode

By default in production (`PI_CLI_FAIL_CLOSED=true`), every Pi CLI route that can take the Mastra path treats workflow availability as a hard contract. When a workflow is requested but Mastra or Trigger.dev cannot fulfil it, routes respond with:

| HTTP | code | When |
| --- | --- | --- |
| `503` | `workflow_disabled` | workflow mode is off (`PI_CLI_USE_WORKFLOWS !== "true"` or Postgres missing) but the caller requested async or `?workflow=true` |
| `503` | `workflow_unavailable` | workflow was dispatched but execution failed (Trigger error, Mastra non-success, exception in workflow step) |

Both include `{ workflow_key, phase: "async" \| "sync", reason?, status? }` under `error.*` for structured handling.

**Per-request override precedence (highest wins):**

1. Header `X-Pi-Fail-Closed: true \| false`
2. Query `?strict=true \| false`
3. Env `PI_CLI_FAIL_CLOSED === "true"` (server default)
4. Otherwise `false` (legacy silent fallback)

This lets integrations opt into soft-fallback for a specific call (e.g. legacy CI) without weakening the production default. Routes affected: `/api/cli/validate`, `/api/cli/learn`, `/api/cli/routine/generate`, `/api/cli/resonate`.

### Verification checklist

After the env flip, confirm production is hot:

1. `curl https://piii-black.vercel.app/api/cli/health` → `200` + `ok: true`.
2. `pi doctor` (with an API key configured) → new `Server readiness` block all green.
3. Soft call: `POST /api/cli/validate` with `X-Pi-Fail-Closed: false` + intentionally invalid workflow input → `200` with legacy semantic result.
4. Strict call: same with `X-Pi-Fail-Closed: true` → `503 workflow_unavailable`.
5. HITL: `pi routine "…" --approval --async` → `202 accepted` + suspended run visible via `POST /api/cli/workflow/poll`.

## Storage and Memory

- `src/lib/mastra-storage.ts` initializes `PostgresStore` and `PgVector`.
- `src/lib/pi-cli-thread.ts` builds deterministic thread/resource ids from org + branch (+ developer).
- `src/lib/pi-cli-memory.ts` creates `Memory` with:
  - last-message history window
  - optional semantic recall (when vector + embedding credentials are available)
  - recall limit controlled by `PI_CLI_MEMORY_RECALL_LIMIT`

## Core Mastra Registry

- `src/mastra/index.ts` registers CLI workflows and agents (`cliEnforcerAgent`, `cliResonateAgent`, `cliArchitectAgent`).
- Storage is attached only when Postgres configuration is present.

## CLI Workflows

### Validate Workflow

`src/mastra/workflows/pi-cli/cli-validate-workflow.ts`

Pipeline:
1. collect memory context + intent confidence
2. branch by confidence:
   - high confidence: run semantic validation (`cliEnforcerAgent` + structured output)
   - low confidence: trigger adaptive engine job
3. merge deterministic + semantic violations

### Routine Workflow

`src/mastra/workflows/pi-cli/cli-routine-workflow.ts`

Pipeline:
1. optional Firecrawl doc grounding (`doc_urls`)
2. **gather-codebase-context** — Mastra memory, R2 import graph, optional CLI `routine_context` (paths, histogram, excerpts, **existing_routines_metadata**), system-style summary
3. **Composer** — `findRelevantRoutines` ranks saved routines (slug/tags/intent + memory)
4. structured draft via `generateObject` + `pi-routine-spec` → Markdown (Pi routine v2 YAML frontmatter); **`files_manifest`** for all touched repo files; **no legacy fallback** (fail fast)
5. suspend for approval (HITL) when `require_approval`
6. resume and save or bail

CLI sends `routine_context` from a lightweight repo scan (`collectRoutineRepoContext`); use `--with-excerpts` for redacted AST hints. Optional `--format cursor,claude,windsurf` writes agent-specific files locally and/or returns `adapter_outputs` from the sync API path.

### Resonate Workflow (v2 — Socratic Loop)

`src/mastra/workflows/pi-cli/cli-resonate-workflow.ts`

Pipeline:
1. **hydrate-context** — gather routine context, deterministic facts, memory recall
2. **ast-analysis** — parallel execution of blast-radius, prerequisite-scanner, and architectural-boundary tools
3. **socratic-debate** — Architect Agent generates SocraticChallenge JSON; suspends for human input via @clack/prompts
4. (loop) resume with user choice → re-formulate challenge → suspend again
5. **commit-memory** — save Architectural Decision Record (ADR) to Mastra Memory
6. **generate-shadow-plan** — produce `.pi-plan.md` with numbered `pi execute <n>` steps

CLI flags: `pi resonate --workflow` enables this path; `pi resonate --plan` generates shadow plan in legacy mode.
New commands: `pi execute [step]` reads/marks `.pi-plan.md` steps; `pi resume [runId]` reconnects to suspended workflows.

### Learn Workflow

`src/mastra/workflows/pi-cli/cli-learn-workflow.ts`

Pipeline:
1. infer system style
2. persist style output
3. trigger graph builder integration

## Agents and Tools

- `src/mastra/agents/cli-enforcer-agent.ts`
  - structured semantic validation output
  - optional memory attachment
  - tools: `extract-ast-snippet`, `query-system-style`, `query-dependency-graph`

- `src/mastra/agents/cli-resonate-agent.ts`
  - Staff Engineer pair-programming agent (legacy stateless resonate)
  - tools: `query-system-style`, `query-dependency-graph`

- `src/mastra/agents/cli-architect-agent.ts` (v2)
  - Principal Engineer for Socratic Loop workflow
  - tools: `query-system-style`, `query-dependency-graph`, `blast-radius`, `prerequisite-scanner`, `architectural-boundary`, `extract-ast-snippet`

### AST Analysis Tools (v2)

- `src/mastra/tools/blast-radius-tool.ts` — trace symbol references across file excerpts via ts-morph
- `src/mastra/tools/prerequisite-scanner-tool.ts` — detect missing infrastructure for a feature intent
- `src/mastra/tools/architectural-boundary-tool.ts` — check Server/Client component boundary violations

## API Surface

- `src/app/api/cli/validate/route.ts`: workflow-backed validation with legacy fallback.
- `src/app/api/cli/routine/generate/route.ts`: workflow-backed routine generation + optional approval mode.
- `src/app/api/cli/learn/route.ts`: workflow-backed learning path.
- `src/app/api/cli/resonate/route.ts`: resonate session — supports `?workflow=true` for Socratic Loop workflow mode, with legacy agent fallback.
- `src/app/api/cli/workflow/status/route.ts`: poll workflow run status (supports `cliResonateWorkflow`).
- `src/app/api/cli/workflow/poll/route.ts`: simplified poll (`status`, `workflow_result`, `suspend_payload`).
- `src/app/api/cli/workflow/resume/route.ts`: resume suspended runs with user decision payload (supports `cliResonateWorkflow`).
- `src/jobs/cli-workflow-runner.ts`: Trigger.dev task for async Mastra workflow execution (`?async=true` on learn/validate/routine).
- `src/app/api/cli/validate/debug/route.ts`: debug/time-travel style step snapshot retrieval.

## CLI UX Integration

- `packages/pi-cli/src/lib/workflow-poller.ts`: polling helper with spinner UX (supports `cliResonateWorkflow`).
- `packages/pi-cli/src/lib/workflow-client.ts`: poll `/api/cli/workflow/poll` until terminal state (async mode).
- `packages/pi-cli/src/commands/validate.ts`
  - sends branch/developer context
  - supports `--debug-run` to inspect workflow snapshots
- `packages/pi-cli/src/commands/routine.ts`
  - supports `--approval`
  - performs suspend/resume interaction loop
- `packages/pi-cli/src/commands/resonate.ts` (v2)
  - `--workflow`: Socratic Loop via Mastra workflow suspend/resume
  - `--plan`: generate `.pi-plan.md` Shadow Plan after consensus
  - Rich @clack/prompts UI: `select()` for alternative paths, `note()` for prerequisites, `log.warn()` for traps
  - Fallback to legacy stateless agent loop when workflow mode unavailable
- `packages/pi-cli/src/commands/execute.ts` (v2)
  - `pi execute`: list plan steps from `.pi-plan.md`
  - `pi execute <n>`: mark step as done, advance to next
  - `pi resume [runId]`: reconnect to suspended workflow run

## Trigger Jobs

These jobs now attempt workflow execution first and fall back safely on errors:

- `src/jobs/cli-workflow-runner.ts` (generic async Pi CLI workflows)
- `src/jobs/cli-graph-builder.ts`
- `src/jobs/cli-adaptive-engine.ts`
- `src/jobs/cli-github-pr-check.ts`

## Adoption UX (CLI)

- **`pi doctor`** — connection, `.pi/` status, local-first vs workflow hints; **`pi doctor --demo`** runs a local Next.js layout boundary check (no API).
- **`printLocalFirstBanner`** (resonate) — explains that standard resonate uses the Pi API only; workflows need server-side `PI_CLI_USE_WORKFLOWS` + Postgres.
- **`.pi/handoff.md`** — written after each saved resonance session; structured copy block for Cursor / Claude / Windsurf.
- **`pi execute <n>`** — appends optional **Receipt** blocks (e.g. `prisma validate`, `tsc --noEmit`, `npm run lint`) inferred from step text.
- **Claims** — API structured output may include `evidence_type` and `confidence` (0–1) for trust UX; CLI displays them in resonate output.

## Operational Notes

- Keep workflow mode gated in production rollouts using environment flags.
- For strict runtime safety, set `PI_MASTRA_DEFAULT_MODEL` in deployed environments.
- Ensure Postgres connectivity before enabling workflows/memory broadly.
