# Artifacts index

Captured JSON from E2E runs, projection tuning, and smoke checks. Use this folder to **reuse a known-good brand snapshot** without paying for another full extraction when building or testing new APIs locally.

## Canonical brand / E2E snapshot (single source of truth)

| | |
|---|---|
| **File** | [`brand-e2e-green-run.json`](./brand-e2e-green-run.json) |
| **Recorded** | `2026-03-24T12:41:45.552Z` (from artifact `timestamp`) |
| **Purpose** | Full green pipeline: extract → job → brand fetch → list → security checks, with complete **`brand_dna`** embedded. |

**Identifiers (copy into `.env.local` or scripts):**

| Field | Value |
|-------|--------|
| `brand_id` | `9f275f56-e08f-47bc-934f-a711014f5401` |
| `org_id` | `f99d39cb-d556-43b0-9d74-9c94c58b2574` |
| `job_id` | `2bb05b50-9de7-46b7-b349-ca887bc1a87c` |

**Where data lives in the JSON:**

- Top-level: `brandId`, `jobId`
- Full brand row (including `brand_dna`): `jobApi.body.data.job_result.brand`
- Same `org_id`: `jobApi.body.data.org_id`

Example env for golden projection / local API tests (must match a brand that still exists in **your** Supabase for live calls):

```env
PROJECTION_GOLDEN_BRAND_ID=9f275f56-e08f-47bc-934f-a711014f5401
PROJECTION_GOLDEN_ORG_ID=f99d39cb-d556-43b0-9d74-9c94c58b2574
```

**Do not** rename or delete `brand-e2e-green-run.json` without updating this README and any pinned env defaults. If you replace the canonical run, overwrite the table above.

---

## Other files (non-canonical)

| File | Notes |
|------|--------|
| `brand-e2e-dynamic-validation.json` | Larger E2E / dynamic validation capture (historical). |
| `brand-e2e-last-run.json` | Last E2E run snapshot (may differ from canonical). |
| `brand-e2e-security-checks.json` | Security-focused E2E output. |
| `brand-production-fixes-validation.json` | Production-fix validation artifact. |
| `brand-project-exact-raw-paragraph.json` | Single projection call with fixed long `use_case` text. |
| `brand-project-tuned-long-paragraph-final.json` | Projection run after tuning (meta/latency). |
| `brand-project-dynamic-validation.json` | Dynamic projection validation batch. |
| `projection-golden-check.json` | Latest `npm run projection:golden-check` output (regression telemetry). |
| `projection-golden-check.*.json` | Historical golden runs (model / token experiments). |
| `projection-hardening-smoke.json` | Projection hardening smoke output. |

---

## Privacy and repo hygiene

- Snapshots include **real-site-derived** `brand_dna`, URLs, and org IDs. **Do not** publish this folder in a public repo without scrubbing or moving fixtures.
- If the repo goes public, replace canonical data with synthetic minimal fixtures or keep artifacts **out of git**.

## Optional slim fixture (future)

If full JSON is too large for reviews, copy only `{ id, org_id, domain, name, brand_dna }` from `jobApi.body.data.job_result.brand` into e.g. `fixtures/brand-canonical.min.json` and point this README there. Not required today.
