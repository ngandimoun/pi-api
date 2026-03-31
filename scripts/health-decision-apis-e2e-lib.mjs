/**
 * Shared helpers + case definitions for health decision API E2E scripts.
 */
import fs from "node:fs";
import path from "node:path";

export function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const DECISION_API_CASES = [
  {
    id: "risk-priority",
    path: "/api/v1/health/risk-priority",
    body: {
      input: {
        type: "patient_data",
        data: JSON.stringify({
          vitals: { hr: 88, spo2: 97 },
          complaint: "routine follow-up",
          history: [],
        }),
      },
      output: { include_diagnostics: true },
    },
  },
  {
    id: "adherence",
    path: "/api/v1/health/adherence",
    body: {
      input: {
        type: "patient_timeline",
        data: JSON.stringify({
          events: [
            { date: "2025-01-01", type: "prescription", detail: "metformin" },
            { date: "2025-01-15", type: "missed_pickup", detail: "pharmacy" },
          ],
        }),
      },
      output: { include_diagnostics: true },
    },
  },
  {
    id: "notes-structure",
    path: "/api/v1/health/notes-structure",
    body: {
      input: {
        type: "clinical_notes",
        data: "Patient c/o headache x2d. PMH HTN. Meds: lisinopril.",
      },
      output: { include_diagnostics: true },
    },
  },
  {
    id: "decision-support",
    path: "/api/v1/health/decision-support",
    body: {
      input: {
        type: "clinical_query",
        data: JSON.stringify({
          presentation: "fever and cough 3 days",
          vitals: { temp_c: 38.1 },
          labs: [],
        }),
      },
      output: { include_diagnostics: true },
    },
  },
  {
    id: "medication-check",
    path: "/api/v1/health/medication-check",
    body: {
      input: {
        type: "medication_review",
        data: JSON.stringify({
          medications: [
            { name: "warfarin", dose: "5mg", frequency: "daily" },
            { name: "aspirin", dose: "81mg", frequency: "daily" },
          ],
          conditions: ["AFib"],
        }),
      },
      output: { include_diagnostics: true },
    },
  },
  {
    id: "scan-analysis",
    path: "/api/v1/health/scan-analysis",
    body: {
      input: {
        type: "medical_scan",
        data: `data:image/png;base64,${TINY_PNG_B64}`,
        modality: "xray",
        clinical_question: "e2e smoke — any acute findings?",
      },
      output: { include_diagnostics: true },
    },
  },
  {
    id: "research-assist",
    path: "/api/v1/health/research-assist",
    body: {
      input: {
        type: "research_query",
        data: JSON.stringify({
          question: "Summarize inclusion criteria for a pragmatic RCT in primary care.",
          domain: "methods",
        }),
      },
      output: { include_diagnostics: true },
    },
  },
];

export async function createApiKey(unkey, orgId) {
  const keyResp = await unkey.keys.createKey({
    apiId: process.env.UNKEY_API_ID,
    prefix: "pi",
    byteLength: 24,
    ownerId: orgId,
    enabled: true,
    meta: { organization_id: orgId },
  });
  if (keyResp?.error || !keyResp?.data?.key) {
    throw new Error(`Unkey createKey failed: ${JSON.stringify(keyResp?.error ?? {})}`);
  }
  return keyResp.data.key;
}

export async function fetchJson(method, url, { apiKey, body, timeoutMs = 120_000 } = {}) {
  const headers = {
    Accept: "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };
  const res = await fetch(url, {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const rawText = await res.text();
  let json;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = { _parse_error: rawText.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, json, rawText };
}

export async function resolveApiKey() {
  const orgId =
    process.env.HEALTH_E2E_ORG_ID?.trim() ||
    process.env.PROJECTION_GOLDEN_ORG_ID?.trim() ||
    process.env.VOICE_E2E_ORG_ID?.trim() ||
    "f99d39cb-d556-43b0-9d74-9c94c58b2574";

  let apiKey = process.env.PI_API_KEY?.trim() || process.env.PI_HEALTH_API_KEY?.trim();
  if (!apiKey) {
    if (!process.env.UNKEY_ROOT_KEY?.trim() || !process.env.UNKEY_API_ID?.trim()) {
      console.error("Set PI_API_KEY or UNKEY_ROOT_KEY + UNKEY_API_ID.");
      process.exit(1);
    }
    const { Unkey } = await import("@unkey/api");
    const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });
    apiKey = await createApiKey(unkey, orgId);
    console.log(`[OK] Minted API key\n`);
  }
  return apiKey;
}

/** Jobs GET caps long-poll at 30s; chain polls for slow Mastra + LLM (same as health-triage-e2e.mjs). */
async function pollJobUntilTerminal(baseUrl, apiKey, jobId) {
  const getPath = `/api/v1/jobs/${jobId}?wait_for_completion=true&timeout_seconds=30&include=diagnostics`;
  let job = await fetchJson("GET", `${baseUrl}${getPath}`, { apiKey, timeoutMs: 120_000 });
  for (let poll = 0; poll < 12 && job.ok && job.json?.data?.status === "processing"; poll++) {
    await new Promise((r) => setTimeout(r, 500));
    job = await fetchJson("GET", `${baseUrl}${getPath}`, { apiKey, timeoutMs: 120_000 });
  }
  return job;
}

/**
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {{ path: string, body: object }} c
 */
export async function runOneCase(baseUrl, apiKey, c) {
  const postUrl = `${baseUrl}${c.path}`;
  console.log(`POST ${c.path}`);
  const post = await fetchJson("POST", postUrl, { apiKey, body: c.body });
  if (!post.ok || post.status !== 202) {
    console.error(`  FAIL status ${post.status}: ${post.rawText.slice(0, 400)}`);
    process.exit(1);
  }
  const jobId = post.json?.data?.job_id;
  if (!jobId) {
    console.error(`  FAIL missing job_id: ${post.rawText.slice(0, 400)}`);
    process.exit(1);
  }
  const poll = await pollJobUntilTerminal(baseUrl, apiKey, jobId);
  if (!poll.ok) {
    console.error(`  FAIL poll ${poll.status}: ${poll.rawText.slice(0, 500)}`);
    process.exit(1);
  }
  const status = poll.json?.data?.status;
  if (status === "queued") {
    console.error(
      `  FAIL job still queued after polls — Trigger.dev worker may be down. ${poll.rawText.slice(0, 400)}`
    );
    process.exit(1);
  }
  if (status === "failed") {
    const err = poll.json?.data?.error_log;
    console.error(`  FAIL job failed: ${String(err ?? "").slice(0, 800)}`);
    process.exit(1);
  }
  if (status !== "completed") {
    console.error(`  FAIL job status ${status}: ${poll.rawText.slice(0, 600)}`);
    process.exit(1);
  }
  const out = poll.json?.data?.payload?.output;
  if (!out || typeof out !== "object") {
    console.error(`  FAIL missing payload.output: ${poll.rawText.slice(0, 500)}`);
    process.exit(1);
  }
  const diags = poll.json?.data?.payload?.diagnostics;
  if (!Array.isArray(diags) || diags.length === 0) {
    console.error(`  FAIL expected non-empty diagnostics when include_diagnostics=true`);
    process.exit(1);
  }
  console.log(`  [OK] job ${jobId} completed (${diags.length} diagnostic steps)`);
}

export async function runDecisionApiE2E(caseFilterId) {
  loadEnvLocal();
  const baseUrl = (process.env.PI_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log(`Base URL: ${baseUrl}\n`);
  const apiKey = await resolveApiKey();

  const list = caseFilterId
    ? DECISION_API_CASES.filter((x) => x.id === caseFilterId)
    : DECISION_API_CASES;

  if (caseFilterId && list.length === 0) {
    console.error(`Unknown case id: ${caseFilterId}. Valid: ${DECISION_API_CASES.map((x) => x.id).join(", ")}`);
    process.exit(1);
  }

  for (const c of list) {
    const { id: _id, ...rest } = c;
    await runOneCase(baseUrl, apiKey, rest);
  }

  if (!caseFilterId) {
    console.log("\nAll seven decision APIs passed smoke.");
  } else {
    console.log(`\nCase "${caseFilterId}" passed.`);
  }
}
