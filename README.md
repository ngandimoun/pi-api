# Pi CLI — The Intelligence Layer for Developers

**Pi CLI** is an AI-powered development tool that understands your codebase and transforms natural language into production-ready implementations. Where developer intent becomes code reality.

- **Landing Page**: http://localhost:3000
- **Documentation**: https://piii.mintlify.app/
- **CLI Package**: `@pi-api/cli` (coming soon)

## Why Pi CLI is revolutionary

- **Conversational Code Intelligence**: Describe what you want in natural language and get complete implementations, not just snippets
- **Contextual Understanding**: Pi CLI analyzes your entire codebase to generate code that fits your patterns and architecture
- **Production-Ready Output**: From authentication systems to deployment configs, Pi CLI ships code that works
- **Seamless Workflow**: One command from idea to implementation—no switching between tools or contexts

## Quick Start

### 1. Get Your API Key
Visit [http://localhost:3000](http://localhost:3000) and sign up with Google to generate your Pi CLI API key.

### 2. Install Pi CLI
```bash
npm install -g @pi-api/cli
```

### 3. Authenticate
```bash
pi auth login --key YOUR_API_KEY
```

### 4. Start Building
```bash
# Generate a complete Next.js app with authentication
pi "Create a Next.js app with Supabase auth and Stripe billing"

# Add features to existing projects
pi "Add real-time chat to my React app"

# Refactor and improve code
pi "Migrate this component to TypeScript with proper types"
```

Then poll:

- `GET /api/v1/jobs/:id?wait_for_completion=true&timeout_seconds=20`

Full envelope + error format is documented in `[docs/v1/intro.mdx](docs/v1/intro.mdx)`.

## API surface (what exists in this repo)

Canonical endpoint index lives in `[docs/README.md](docs/README.md)`. High-level grouping:

### Brand intelligence (identity → usable JSON)

- **Extract** brand DNA: `POST /api/v1/brands/extract`
- **List / get** brands: `GET /api/v1/brands`, `GET /api/v1/brands/:id`
- **Project** identity into a compact `use_case` payload: `POST /api/v1/brands/:id/project`

Docs:

- `[docs/v1/endpoints/brand-extraction.mdx](docs/v1/endpoints/brand-extraction.mdx)`
- `[docs/v1/endpoints/brand-project.mdx](docs/v1/endpoints/brand-project.mdx)`

### Visual commerce (static ads + campaign pipelines)

- `POST /api/v1/images/generations` (OpenAI-compatible async image generation)
- `POST /api/v1/ads/generate` (alias)
- `POST /api/v1/campaigns/generate`
- `POST /api/v1/campaigns/edit`
- `POST /api/v1/campaigns/localize-ad`
- `POST /api/v1/images/campaigns` (alias)
- `POST /api/v1/avatars/generate` + list/get/save (`/api/v1/avatars`*)

Guide:

- `[docs/v1/guides/pipeline-orchestration.mdx](docs/v1/guides/pipeline-orchestration.mdx)`

### Voice intelligence (LiveKit + Gemini Live)

Configure reusable agents, start realtime sessions, then complete with transcripts for structured results.

- Voice agents: `POST|GET|PATCH|DELETE /api/v1/voice/agents`
- Sessions: `POST /api/v1/voice/sessions`, `GET /api/v1/voice/sessions/:id`, `POST /api/v1/voice/sessions/:id/complete`
- LiveKit webhook (signed): `POST /api/v1/voice/webhooks/livekit`

Docs:

- `[docs/v1/endpoints/voice.mdx](docs/v1/endpoints/voice.mdx)`
- `[docs/v1/guides/voice-sessions.mdx](docs/v1/guides/voice-sessions.mdx)`

### Health intelligence (triage + decision APIs)

All health endpoints are **async job APIs**: `POST` → `202 job_id` → poll jobs for `payload.output`.

- Point-of-care triage: `POST /api/v1/health/analyze` (`[docs/v1/health-triage.mdx](docs/v1/health-triage.mdx)`)
- Decision suite (7 endpoints): overview in `[docs/v1/health-decision-apis.mdx](docs/v1/health-decision-apis.mdx)`

### Neuro / BCI (EEG decode + wellness)

- `POST /api/v1/neuro/decode` (`[docs/v1/neuro-decode.mdx](docs/v1/neuro-decode.mdx)`)
- `POST /api/v1/health/wellness` (`[docs/v1/cognitive-wellness.mdx](docs/v1/cognitive-wellness.mdx)`)

### Video surveillance + robotics

- Surveillance: streams/policies/events (SSE) (`[docs/v1/video-surveillance.mdx](docs/v1/video-surveillance.mdx)`)
- Robotics: runs/status/command/events (`[docs/v1/robotics-api.mdx](docs/v1/robotics-api.mdx)`)

### Infrastructure endpoints (jobs, runs, webhooks)

- Jobs: `GET /api/v1/jobs/:id` (`[docs/v1/endpoints/jobs.mdx](docs/v1/endpoints/jobs.mdx)`)
- Runs (one-request pipelines): `POST /api/v1/runs`, `GET /api/v1/runs/:id` (`[docs/v1/endpoints/runs.mdx](docs/v1/endpoints/runs.mdx)`)
- Webhooks registry: `GET|POST /api/v1/webhooks`, `PATCH /api/v1/webhooks/:id` (`[docs/v1/endpoints/webhooks.mdx](docs/v1/endpoints/webhooks.mdx)`)

## Quickstart (curl)

Full copy/paste examples (curl, fetch, Python) are in `[docs/v1/quickstart.mdx](docs/v1/quickstart.mdx)`. Minimal end-to-end:

```bash
export BASE="https://api.example.com"
export API_KEY="pi_live_***"

# 1) Queue brand extraction
job_id=$(curl -sS -X POST "$BASE/api/v1/brands/extract" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d).data.job_id))")

# 2) Long-poll job
curl -sS "$BASE/api/v1/jobs/$job_id?wait_for_completion=true&timeout_seconds=20&expand=brand" \
  -H "Authorization: Bearer $API_KEY"
```

## TypeScript SDK (published package)

There is a package under `packages/pi-sdk`:

```bash
npm install @pi-api/sdk
```

Docs:

- `[packages/pi-sdk/README.md](packages/pi-sdk/README.md)`

## Pi CLI (Hokage Edition)

Local CLI + `pi-hokage` onboarding wizard live under `packages/pi-cli` and `packages/pi-hokage`:

```bash
npx pi-hokage@latest
# or
npm install -g @pi-api/cli
pi learn
```

- API routes: `/api/cli/*` (auth, learn, routine, validate, intent, cache, GitHub webhook)
- Install script (for your deployed app): `GET /hokage` → shell installer

See `[packages/pi-cli/README.md](packages/pi-cli/README.md)`.

### Mastra-powered CLI orchestration

The CLI pipeline now supports deterministic, auditable orchestration with Mastra:

- Workflow-backed command execution for `learn`, `routine`, and `validate`
- Optional thread-aware memory scoped by organization + branch (+ developer)
- HITL suspend/resume for routine approval flows
- Workflow status/resume/debug API routes under `/api/cli/workflow/*` and `/api/cli/validate/debug`

Enable with environment flags:

- `PI_CLI_USE_WORKFLOWS=true`
- `PI_CLI_ROUTINE_HITL=true` (for approval gates in `pi routine --approval`)
- `PI_CLI_DATABASE_URL=<postgres-connection>` (required for workflow storage + memory)
- `PI_MASTRA_DEFAULT_MODEL=<provider/model>`

Architecture details: `[docs/cli/mastra-architecture.md](docs/cli/mastra-architecture.md)`.

Production verification (automated):

- `npx vitest run tests/mastra/mastra-registry.test.ts tests/mastra/mastra-architect-tools.test.ts` — registry + tool wiring (no live HTTP).
- `npm run verify:mastra-hokage` — `GET /api/cli/health` (set `PI_BASE_URL` for remote). With `PI_API_KEY` or Unkey mint env vars, runs validate / async / HITL / trace checks (`scripts/mastra-hokage-verify.mjs`).
- `npm run verify:mastra-schema` — confirms `mastra` schema when `PI_CLI_DATABASE_URL` is set.

## Local development

- `npm install`
- `npm run dev`
- Configure env via `.env.local` and restart `next dev` after changes (details in `[docs/v1/intro.mdx](docs/v1/intro.mdx)`).



