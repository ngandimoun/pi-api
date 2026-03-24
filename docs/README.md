# Pi API documentation

Single entry point for the **v1 HTTP API** (agentic brand identity, jobs, and projection).

## Start here

| Doc | Purpose |
|-----|---------|
| [Introduction](./v1/intro.mdx) | Auth, envelopes, `expand=`, headers, deploy checklist |
| [Quickstart](./v1/quickstart.mdx) | End-to-end integration: curl, `fetch`, Python, optional in-repo SDK |

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

## Source of truth in code

- **Routes:** `src/app/api/v1/`
- **Request/response contracts (Zod):** `src/contracts/brand-api.ts`
- **Typed HTTP client (this repo):** `src/sdk/client.ts` (`createPiClient`)
- **Operations (keys, DB, workers, golden check, alerts):** [`architecture/operations-runbook.md`](../architecture/operations-runbook.md)

## Marketing / landing copy

Reusable short copy for a marketing site lives in [marketing/product-blurbs.md](./marketing/product-blurbs.md) (not the full API reference).

## Saved E2E / brand snapshots

To reuse a captured **`brand_id`** and **`brand_dna`** without running extraction again, see [artifacts/README.md](../artifacts/README.md) (canonical green run + env hints).
