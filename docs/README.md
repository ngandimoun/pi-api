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
| [MetaBCI (neuro / BCI, Python)](./integrations/metabci.md) | EEG/BCI stack: `services/metabci-neuro`, Docker, limits, license, agent/API boundaries |
| [Braindecode (neuro DL, Python)](./integrations/braindecode.md) | PyTorch EEG/MEG/ECoG decoders; pinned with MetaBCI in API/full locks; BSD-3-Clause vs GPL |
| [MOABB (BCI benchmarks, Python)](./integrations/moabb.md) | Reproducible EEG BCI benchmarks: datasets, paradigms, evaluations, pipelines; BSD-3-Clause |
| [MONAI (medical imaging, Python)](./integrations/monai.md) | MONAI Core + Model Zoo bundles (`monai[fire]`); separate `services/monai-imaging/`; Apache-2.0; bundle/data licenses per model |
| [HuatuoGPT (medical LLMs, reference)](./integrations/huatuogpt.md) | FreedomIntelligence: o1 reasoning, HuatuoGPT-II, HuatuoGPT-Vision; optional self-hosted HF models; safety + license caveats |
| [MedGemma (Google HAI-DEF)](./integrations/medgemma.md) | Gemma 3 medical multimodal (e.g. `google/medgemma-1.5-4b-it`); Vertex / HF / vLLM; HAI-DEF terms; not clinical-grade without validation |
| [TxGemma (Google HAI-DEF)](./integrations/txgemma.md) | Gemma 2 therapeutics / TDC tasks; predict vs chat; Vertex / HF; HAI-DEF terms; R&D validation required |

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
| `POST` | `/api/v1/health/analyze` | Async point-of-care triage (image / EEG) | [health-triage.mdx](./v1/health-triage.mdx) |
| `POST` | `/api/v1/neuro/decode` | Async BCI / EEG intent decode (Neural-Mobility) | [neuro-decode.mdx](./v1/neuro-decode.mdx) |
| `POST` | `/api/v1/health/wellness` | Async cognitive wellness & mental-health adjacent coaching (EEG + optional vision) | [cognitive-wellness.mdx](./v1/cognitive-wellness.mdx) |
| `POST` | `/api/v1/health/risk-priority` | Patient risk & priority queueing (actionable next steps) | [patient-risk-priority.mdx](./v1/patient-risk-priority.mdx) · [overview](./v1/health-decision-apis.mdx) |
| `POST` | `/api/v1/health/adherence` | Missed follow-up / adherence detection | [adherence-detection.mdx](./v1/adherence-detection.mdx) · [overview](./v1/health-decision-apis.mdx) |
| `POST` | `/api/v1/health/notes-structure` | Clinical notes → structured entities & timeline | [notes-structure.mdx](./v1/notes-structure.mdx) · [overview](./v1/health-decision-apis.mdx) |
| `POST` | `/api/v1/health/decision-support` | Clinical decision support (reasoning + safety layer) | [clinical-decision-support.mdx](./v1/clinical-decision-support.mdx) · [overview](./v1/health-decision-apis.mdx) |
| `POST` | `/api/v1/health/medication-check` | Medication intelligence (interactions, adherence, optimization hints) | [medication-check.mdx](./v1/medication-check.mdx) · [overview](./v1/health-decision-apis.mdx) |
| `POST` | `/api/v1/health/scan-analysis` | Medical scan analysis + plain-language explanation | [scan-analysis.mdx](./v1/scan-analysis.mdx) · [overview](./v1/health-decision-apis.mdx) |
| `POST` | `/api/v1/health/research-assist` | Research acceleration (analysis, methods, next steps) | [research-assist.mdx](./v1/research-assist.mdx) · [overview](./v1/health-decision-apis.mdx) |
| `POST` | `/api/v1/surveillance/streams` | Async programmable video intelligence (perception + policies + narration) | [video-surveillance.mdx](./v1/video-surveillance.mdx) |
| `POST` | `/api/v1/surveillance/policies` | Create/update behavior policies | [video-surveillance.mdx](./v1/video-surveillance.mdx) |
| `GET` | `/api/v1/surveillance/events` | SSE incident stream | [video-surveillance.mdx](./v1/video-surveillance.mdx) |
| `POST` | `/api/v1/robots/run` | Async agentic robotics run (behaviors + decisions + actions) | [robotics-api.mdx](./v1/robotics-api.mdx) |
| `GET` | `/api/v1/robots/:id/status` | Robot status | [robotics-api.mdx](./v1/robotics-api.mdx) |
| `POST` | `/api/v1/robots/:id/command` | Direct robot command | [robotics-api.mdx](./v1/robotics-api.mdx) |
| `GET` | `/api/v1/robots/events` | SSE robotics events | [robotics-api.mdx](./v1/robotics-api.mdx) |

## Source of truth in code

- **Routes:** `src/app/api/v1/`
- **Request/response contracts (Zod):** `src/contracts/brand-api.ts`
- **Typed HTTP client (this repo):** `src/sdk/client.ts` (`createPiClient`)
- **Operations (keys, DB, workers, golden check, alerts):** [`architecture/operations-runbook.md`](../architecture/operations-runbook.md)

## Marketing / landing copy

Reusable short copy for a marketing site lives in [marketing/product-blurbs.md](./marketing/product-blurbs.md) (not the full API reference).

## Saved E2E / brand snapshots

To reuse a captured **`brand_id`** and **`brand_dna`** without running extraction again, see [artifacts/README.md](../artifacts/README.md) (canonical green run + env hints).
