/**
 * Cognitive wellness API E2E (real HTTP + Unkey). Mirrors scripts/neuro-decode-e2e.mjs.
 *
 * Requires: Next.js dev, Trigger.dev worker, GEMINI_KEY in .env.local (cognitive + synthesis).
 *
 * Optional second scenario: set HUATUOGPT_ENDPOINT (+ model) to exercise `image_data` with a 1x1 PNG.
 * If Huatuo is not configured, that scenario is skipped (soft-pass).
 *
 *   node scripts/cognitive-wellness-e2e.mjs
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
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

const STUB_EEG_B64 = Buffer.from(JSON.stringify({ v: 1, samples_stub: true, len: 128 })).toString("base64");

/** 1x1 PNG — valid image bytes for multimodal paths. */
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function createApiKey(unkey, orgId) {
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

async function fetchJson(method, url, { apiKey, body, timeoutMs = 120_000 } = {}) {
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

async function pollJob(baseUrl, apiKey, jobId) {
  const getPath = `/api/v1/jobs/${jobId}?wait_for_completion=true&timeout_seconds=30&include=diagnostics`;
  let job = await fetchJson("GET", `${baseUrl}${getPath}`, { apiKey });
  for (let poll = 0; poll < 8 && job.ok && job.json?.data?.status === "processing"; poll++) {
    await new Promise((r) => setTimeout(r, 500));
    job = await fetchJson("GET", `${baseUrl}${getPath}`, { apiKey });
  }
  return job;
}

function assertWellnessOutput(label, data) {
  const out = data?.payload?.output;
  const diagnostics = data?.payload?.diagnostics ?? [];

  const step2 = diagnostics.find((d) => d?.step === "step2_eeg_decode");
  const step3 = diagnostics.find((d) => d?.step === "step3_cognitive_state");
  const step4 = diagnostics.find((d) => d?.step === "step4_coach_report");

  if (step2?.status !== "ok" && step2?.status !== "failed") {
    throw new Error(`[${label}] step2 missing`);
  }
  if (step3?.status !== "ok" && step3?.status !== "failed") {
    throw new Error(`[${label}] step3 missing`);
  }
  if (step4?.status !== "ok" && step4?.status !== "failed") {
    throw new Error(`[${label}] step4 missing`);
  }

  const coach = typeof out?.coaching_message === "string" ? out.coaching_message.trim() : "";
  if (coach.length < 1) {
    throw new Error(`[${label}] empty coaching_message`);
  }
  const summary = typeof out?.wellness_summary === "string" ? out.wellness_summary.trim() : "";
  if (summary.length < 1) {
    throw new Error(`[${label}] empty wellness_summary`);
  }

  const d4 = step4?.detail && typeof step4.detail === "object" ? step4.detail : {};
  const fb4 = Array.isArray(d4.routing_fallbacks) ? d4.routing_fallbacks : null;
  if (fb4 === null) {
    throw new Error(`[${label}] step4.detail.routing_fallbacks missing`);
  }

  console.log(
    `[${label}] OK coach=${coach.slice(0, 50)} step3=${step3?.status} step4=${step4?.status} fb4=${JSON.stringify(fb4)}`
  );
  return true;
}

async function runScenario(baseUrl, apiKey, { label, withImage }) {
  const body = {
    input: {
      type: "eeg",
      data: STUB_EEG_B64,
      modality: "cognitive_wellness",
      device: "e2e_stub",
      channels: 8,
      sample_rate: 250,
      ...(withImage ? { image_data: `data:image/png;base64,${TINY_PNG_B64}` } : {}),
    },
    context: { locale: "en", session_goal: "e2e_wellness" },
    output: { format: "json", include_diagnostics: true },
  };

  const postUrl = `${baseUrl}/api/v1/health/wellness`;
  const post = await fetchJson("POST", postUrl, { apiKey, body });
  if (!post.ok || post.status !== 202) {
    throw new Error(`POST failed ${label} status=${post.status} body=${post.rawText.slice(0, 400)}`);
  }
  const jobId = post.json?.data?.job_id;
  if (!jobId) throw new Error("missing job_id");

  const job = await pollJob(baseUrl, apiKey, jobId);
  const data = job.json?.data;
  const st = data?.status;

  if (st === "queued") {
    console.log(`[${label}] WARN: still queued (Trigger worker?)`);
    return false;
  }
  if (st === "failed") {
    console.log(`[${label}] WARN: job failed`, data?.error_log?.slice?.(0, 300));
    return false;
  }
  if (st !== "completed") {
    console.log(`[${label}] WARN: status=${st}`);
    return false;
  }

  return assertWellnessOutput(label, data);
}

async function main() {
  loadEnvLocal();

  const baseUrl = (process.env.PI_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const orgId =
    process.env.HEALTH_E2E_ORG_ID?.trim() ||
    process.env.PROJECTION_GOLDEN_ORG_ID?.trim() ||
    process.env.VOICE_E2E_ORG_ID?.trim() ||
    "f99d39cb-d556-43b0-9d74-9c94c58b2574";

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Org: ${orgId}\n`);

  let apiKey = process.env.PI_API_KEY?.trim() || process.env.PI_HEALTH_API_KEY?.trim();
  if (!apiKey) {
    if (!process.env.UNKEY_ROOT_KEY?.trim() || !process.env.UNKEY_API_ID?.trim()) {
      console.error("Set PI_API_KEY or UNKEY_ROOT_KEY + UNKEY_API_ID.");
      process.exit(1);
    }
    const { Unkey } = await import("@unkey/api");
    const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });
    apiKey = await createApiKey(unkey, orgId);
    console.log(`Minted API key (prefix ${apiKey.slice(0, 12)}...)\n`);
  }

  let ok = 0;
  const total = process.env.HUATUOGPT_ENDPOINT?.trim() ? 2 : 1;

  try {
    if (await runScenario(baseUrl, apiKey, { label: "eeg_only", withImage: false })) ok++;
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  if (process.env.HUATUOGPT_ENDPOINT?.trim()) {
    try {
      if (await runScenario(baseUrl, apiKey, { label: "eeg_plus_image", withImage: true })) ok++;
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    console.log("[skip] HUATUOGPT_ENDPOINT not set — skipping image scenario.");
  }

  console.log(`\n[OK] Completed ${ok}/${total} wellness scenario(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
