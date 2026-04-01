# Pi (PI Intelligence) — OpenAI-compatible agentic intelligence APIs

**Pi** is an enterprise-grade **Agentic Infrastructure Intelligence Platform**: a multi-modal orchestration API with a predictable, **OpenAI-style** developer experience (Bearer auth, consistent envelopes, async jobs, typed contracts).

- **Docs hub**: [`docs/README.md`](docs/README.md)
- **Start here**: [`docs/v1/intro.mdx`](docs/v1/intro.mdx)
- **Copy/paste quickstart**: [`docs/v1/quickstart.mdx`](docs/v1/quickstart.mdx)

## Why Pi is useful

- **One API surface, many verticals**: brand identity, visual ads, voice agents, health decision support, neuro/BCI decoding, video surveillance, and robotics—using the same auth + job lifecycle patterns.
- **Production-first async**: heavy work returns `202 Accepted` + `job_id` / `run_id`, then you poll for completion (or subscribe via SSE where supported).
- **Deterministic + model-backed**: contracts are validated (Zod), with fallbacks and diagnostics designed for real operations.

## Core API patterns (v1)

- **Base URL**: your deployed host. Public routes are under **`/api/v1/`**.
- **Authentication**: every request includes:

```http
Authorization: Bearer <pi_api_key>
Content-Type: application/json
```

- **Async jobs**: creation endpoints typically respond:

```json
{ "object": "job", "status": "queued", "data": { "job_id": "<uuid>" } }
```

Then poll:

- `GET /api/v1/jobs/:id?wait_for_completion=true&timeout_seconds=20`

Full envelope + error format is documented in [`docs/v1/intro.mdx`](docs/v1/intro.mdx).

## API surface (what exists in this repo)

Canonical endpoint index lives in [`docs/README.md`](docs/README.md). High-level grouping:

### Brand intelligence (identity → usable JSON)

- **Extract** brand DNA: `POST /api/v1/brands/extract`
- **List / get** brands: `GET /api/v1/brands`, `GET /api/v1/brands/:id`
- **Project** identity into a compact `use_case` payload: `POST /api/v1/brands/:id/project`

Docs:
- [`docs/v1/endpoints/brand-extraction.mdx`](docs/v1/endpoints/brand-extraction.mdx)
- [`docs/v1/endpoints/brand-project.mdx`](docs/v1/endpoints/brand-project.mdx)

### Visual commerce (static ads + campaign pipelines)

- `POST /api/v1/images/generations` (OpenAI-compatible async image generation)
- `POST /api/v1/ads/generate` (alias)
- `POST /api/v1/campaigns/generate`
- `POST /api/v1/campaigns/edit`
- `POST /api/v1/campaigns/localize-ad`
- `POST /api/v1/images/campaigns` (alias)
- `POST /api/v1/avatars/generate` + list/get/save (`/api/v1/avatars*`)

Guide:
- [`docs/v1/guides/pipeline-orchestration.mdx`](docs/v1/guides/pipeline-orchestration.mdx)

### Voice intelligence (LiveKit + Gemini Live)

Configure reusable agents, start realtime sessions, then complete with transcripts for structured results.

- Voice agents: `POST|GET|PATCH|DELETE /api/v1/voice/agents`
- Sessions: `POST /api/v1/voice/sessions`, `GET /api/v1/voice/sessions/:id`, `POST /api/v1/voice/sessions/:id/complete`
- LiveKit webhook (signed): `POST /api/v1/voice/webhooks/livekit`

Docs:
- [`docs/v1/endpoints/voice.mdx`](docs/v1/endpoints/voice.mdx)
- [`docs/v1/guides/voice-sessions.mdx`](docs/v1/guides/voice-sessions.mdx)

### Health intelligence (triage + decision APIs)

All health endpoints are **async job APIs**: `POST` → `202 job_id` → poll jobs for `payload.output`.

- Point-of-care triage: `POST /api/v1/health/analyze` ([`docs/v1/health-triage.mdx`](docs/v1/health-triage.mdx))
- Decision suite (7 endpoints): overview in [`docs/v1/health-decision-apis.mdx`](docs/v1/health-decision-apis.mdx)

### Neuro / BCI (EEG decode + wellness)

- `POST /api/v1/neuro/decode` ([`docs/v1/neuro-decode.mdx`](docs/v1/neuro-decode.mdx))
- `POST /api/v1/health/wellness` ([`docs/v1/cognitive-wellness.mdx`](docs/v1/cognitive-wellness.mdx))

### Video surveillance + robotics

- Surveillance: streams/policies/events (SSE) ([`docs/v1/video-surveillance.mdx`](docs/v1/video-surveillance.mdx))
- Robotics: runs/status/command/events ([`docs/v1/robotics-api.mdx`](docs/v1/robotics-api.mdx))

### Infrastructure endpoints (jobs, runs, webhooks)

- Jobs: `GET /api/v1/jobs/:id` ([`docs/v1/endpoints/jobs.mdx`](docs/v1/endpoints/jobs.mdx))
- Runs (one-request pipelines): `POST /api/v1/runs`, `GET /api/v1/runs/:id` ([`docs/v1/endpoints/runs.mdx`](docs/v1/endpoints/runs.mdx))
- Webhooks registry: `GET|POST /api/v1/webhooks`, `PATCH /api/v1/webhooks/:id` ([`docs/v1/endpoints/webhooks.mdx`](docs/v1/endpoints/webhooks.mdx))

## Quickstart (curl)

Full copy/paste examples (curl, fetch, Python) are in [`docs/v1/quickstart.mdx`](docs/v1/quickstart.mdx). Minimal end-to-end:

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
- [`packages/pi-sdk/README.md`](packages/pi-sdk/README.md)

## Local development

- `npm install`
- `npm run dev`
- Configure env via `.env.local` and restart `next dev` after changes (details in [`docs/v1/intro.mdx`](docs/v1/intro.mdx)).



