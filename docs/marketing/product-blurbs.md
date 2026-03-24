# Pi — marketing copy (landing / hero)

Short blocks you can paste into a marketing site or deck. Full technical detail stays in [`docs/README.md`](../README.md) and [`docs/v1/quickstart.mdx`](../v1/quickstart.mdx).

---

## One-liner

**Pi** is an agentic infrastructure API for brand identity: extract omnivorous brand DNA from the web or assets, run it through durable jobs, and project compact, use-case-specific JSON for your agents and frontends — with Bearer auth, rate limits, and OpenAI-style envelopes.

---

## Three-step integration

1. **Extract** — `POST /api/v1/brands/extract` with a URL or images; get a job id.
2. **Complete** — Poll `GET /api/v1/jobs/:id` with long-poll and optional `expand=brand`.
3. **Project** — `POST /api/v1/brands/:id/project` with a natural-language `use_case` for tokens, themes, or codegen context.

---

## Security and operations

- **Server-side keys only** — API keys are Bearer tokens; never ship them to browsers.
- **Tracing** — Responses include `X-Request-Id` (`req_pi_…`); quote it in support tickets.
- **Rate limits** — `X-RateLimit-*` headers describe your current window.

---

## Link to full API reference

- Documentation hub: `docs/README.md` in the repo (endpoint table + links).
- Quickstart: `docs/v1/quickstart.mdx` (curl, fetch, Python).

---

## Optional hero code sample

Use the same **fetch** example as in the Quickstart so marketing and docs never drift. See `docs/v1/quickstart.mdx` section “TypeScript — external integration (`fetch`)”.
