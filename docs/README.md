# Pi API documentation

Single entry point for the **v1 HTTP API** (agentic brand identity, jobs, and projection).

## Start here

| Doc | Purpose |
|-----|---------|
| [Introduction](./v1/intro.mdx) | Auth, envelopes, `expand=`, headers, deploy checklist |
| [Quickstart](./v1/quickstart.mdx) | End-to-end integration: curl, `fetch`, Python, optional in-repo SDK |
| [Pipeline orchestration guide](./v1/guides/pipeline-orchestration.mdx) | How to use Brand + Campaign + Runs APIs together |
| [Voice sessions guide](./v1/guides/voice-sessions.mdx) | LiveKit + Gemini Live dual connection, `max_duration_seconds`, client auto-end |

## Integrations / vendor reference

| Doc | Purpose |
|-----|---------|
| [Nano Banana / Gemini image API](./integrations/nano-banana-gemini-image.md) | Native Gemini image generation (Nano Banana 2 policy, capability matrix, REST/SDK patterns) |
| [LiveKit (internal stack)](./integrations/livekit.md) | Transport, webhooks, voice topology, max call duration notes |
| [Gemini Live API](./integrations/gemini-live-api.md) | Ephemeral tokens, audio formats, session limits |

## Prerequisites

- **Base URL:** your deployed host (e.g. `https://api.example.com`). All routes are under `/api/v1/`.
- **Authentication:** `Authorization: Bearer <api_key>` on every request. Keys are verified via Unkey; do not expose keys in browsers or client-only apps.

## Local development

Restart `next dev` after editing `.env.local`. Use a single dev server on a known port; set `PI_BASE_URL` for scripts if not using `http://localhost:3000`. See [Introduction — Local development](./v1/intro.mdx).

## v1 endpoint reference

| Method | Path | Description | MDX |
|--------|------|-------------|-----|
| `POST` | `/api/v1/brands/extract` | Queue async brand extraction (URL / logo / images) | [brand-extraction.mdx](./v1/endpoints/brand-extraction.mdx) |
| `GET` | `/api/v1/brands` | List brands (search, pagination, optional `latest_job`) | [list-brands.mdx](./v1/endpoints/list-brands.mdx) |
| `GET` | `/api/v1/brands/:id` | Get one brand by UUID | [get-brand.mdx](./v1/endpoints/get-brand.mdx) |
| `POST` | `/api/v1/brands/:id/project` | Project stored DNA into a compact `use_case` payload | [brand-project.mdx](./v1/endpoints/brand-project.mdx) |
| `GET` | `/api/v1/jobs/:id` | Poll job status, long-poll, optional `expand=brand` | [jobs.mdx](./v1/endpoints/jobs.mdx) |
| `POST` | `/api/v1/avatars/generate` | Queue async avatar generation | [avatars.mdx](./v1/endpoints/avatars.mdx) |
| `GET` | `/api/v1/avatars` | List saved avatars | [avatars.mdx](./v1/endpoints/avatars.mdx) |
| `GET` | `/api/v1/avatars/:id` | Retrieve a saved avatar | [avatars.mdx](./v1/endpoints/avatars.mdx) |
| `POST` | `/api/v1/avatars/save` | Save a completed avatar job | [avatars.mdx](./v1/endpoints/avatars.mdx) |
| `POST` | `/api/v1/images/generations` | OpenAI-compatible async static ads generation | [images-generations.mdx](./v1/endpoints/images-generations.mdx) |
| `POST` | `/api/v1/ads/generate` | Alias route for static ads generation | [ads-generate.mdx](./v1/endpoints/ads-generate.mdx) |
| `POST` | `/api/v1/campaigns/generate` | Campaign-grade static ads generation | [campaigns-generate.mdx](./v1/endpoints/campaigns-generate.mdx) |
| `POST` | `/api/v1/campaigns/edit` | Edit a generated/edited campaign image | [campaigns-edit.mdx](./v1/endpoints/campaigns-edit.mdx) |
| `POST` | `/api/v1/campaigns/localize-ad` | Localize a campaign image for target market | [campaigns-localize-ad.mdx](./v1/endpoints/campaigns-localize-ad.mdx) |
| `POST` | `/api/v1/images/campaigns` | Image-style alias for campaign ads generation | [images-campaigns.mdx](./v1/endpoints/images-campaigns.mdx) |
| `POST` | `/api/v1/runs` | Create a multi-step pipeline run | [runs.mdx](./v1/endpoints/runs.mdx) |
| `GET` | `/api/v1/runs/:id` | Retrieve run status and step results | [runs.mdx](./v1/endpoints/runs.mdx) |
| `GET` | `/api/v1/webhooks` | List webhooks | [webhooks.mdx](./v1/endpoints/webhooks.mdx) |
| `POST` | `/api/v1/webhooks` | Register webhook | [webhooks.mdx](./v1/endpoints/webhooks.mdx) |
| `PATCH` | `/api/v1/webhooks/:id` | Enable/disable webhook | [webhooks.mdx](./v1/endpoints/webhooks.mdx) |
| `POST` | `/api/v1/voice/agents` | Create voice agent | [voice.mdx](./v1/endpoints/voice.mdx) |
| `GET` | `/api/v1/voice/agents` | List voice agents | [voice.mdx](./v1/endpoints/voice.mdx) |
| `GET` | `/api/v1/voice/agents/:id` | Get voice agent | [voice.mdx](./v1/endpoints/voice.mdx) |
| `PATCH` | `/api/v1/voice/agents/:id` | Update voice agent | [voice.mdx](./v1/endpoints/voice.mdx) |
| `DELETE` | `/api/v1/voice/agents/:id` | Soft-delete voice agent | [voice.mdx](./v1/endpoints/voice.mdx) |
| `POST` | `/api/v1/voice/sessions` | Start voice session (LiveKit + Gemini Live) | [voice.mdx](./v1/endpoints/voice.mdx) |
| `GET` | `/api/v1/voice/sessions/:id` | Get voice session | [voice.mdx](./v1/endpoints/voice.mdx) |
| `POST` | `/api/v1/voice/sessions/:id/complete` | Complete with transcript + structured results | [voice.mdx](./v1/endpoints/voice.mdx) |
| `POST` | `/api/v1/voice/webhooks/livekit` | LiveKit webhook (signed) | [voice.mdx](./v1/endpoints/voice.mdx) |

## Source of truth in code

- **Routes:** `src/app/api/v1/`
- **Request/response contracts (Zod):** `src/contracts/brand-api.ts`
- **Typed HTTP client (this repo):** `src/sdk/client.ts` (`createPiClient`)
- **Operations (keys, DB, workers, golden check, alerts):** [`architecture/operations-runbook.md`](../architecture/operations-runbook.md)

## Marketing / landing copy

Reusable short copy for a marketing site lives in [marketing/product-blurbs.md](./marketing/product-blurbs.md) (not the full API reference).

## Saved E2E / brand snapshots

To reuse a captured **`brand_id`** and **`brand_dna`** without running extraction again, see [artifacts/README.md](../artifacts/README.md) (canonical green run + env hints).
