/**
 * Neuro decode API E2E (real HTTP + Unkey). Mirrors scripts/health-triage-e2e.mjs.
 *
 * Requires: Next.js dev, Trigger.dev worker, GEMINI_KEY in .env.local (for decode fallback).
 *
 *   node scripts/neuro-decode-e2e.mjs
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

async function runScenario(baseUrl, apiKey, paradigm) {
  const body = {
    input: {
      type: "eeg",
      data: STUB_EEG_B64,
      paradigm,
      device: "e2e_stub",
      channels: 8,
      sample_rate: 250,
    },
    context: { locale: "en", session_history: ["rest"], ui_mode: "e2e" },
    output: { format: "json", include_diagnostics: true },
  };

  const postUrl = `${baseUrl}/api/v1/neuro/decode`;
  const post = await fetchJson("POST", postUrl, { apiKey, body });
  if (!post.ok || post.status !== 202) {
    throw new Error(`POST failed paradigm=${paradigm} status=${post.status} body=${post.rawText.slice(0, 400)}`);
  }
  const jobId = post.json?.data?.job_id;
  if (!jobId) throw new Error("missing job_id");

  const job = await pollJob(baseUrl, apiKey, jobId);
  const data = job.json?.data;
  const st = data?.status;

  if (st === "queued") {
    console.log(`[${paradigm}] WARN: still queued (Trigger worker?)`);
    return false;
  }
  if (st === "failed") {
    console.log(`[${paradigm}] WARN: job failed`, data?.error_log?.slice?.(0, 300));
    return false;
  }
  if (st !== "completed") {
    console.log(`[${paradigm}] WARN: status=${st}`);
    return false;
  }

  const out = data?.payload?.output;
  const diagnostics = data?.payload?.diagnostics ?? [];

  const step2 = diagnostics.find((d) => d?.step === "step2_eeg_decode");
  const step3 = diagnostics.find((d) => d?.step === "step3_intent_interpretation");
  const step4 = diagnostics.find((d) => d?.step === "step4_predictive_output");

  if (step2?.status !== "ok" && step2?.status !== "failed") {
    throw new Error(`[${paradigm}] step2 missing`);
  }
  if (step3?.status !== "ok") {
    throw new Error(`[${paradigm}] expected step3 ok, got ${step3?.status}`);
  }
  if (step4?.status !== "ok") {
    throw new Error(`[${paradigm}] expected step4 ok, got ${step4?.status}`);
  }

  const intent = typeof out?.decoded_intent === "string" ? out.decoded_intent.trim() : "";
  if (intent.length < 1) {
    throw new Error(`[${paradigm}] empty decoded_intent`);
  }
  const pred = typeof out?.predicted_text === "string" ? out.predicted_text.trim() : "";
  if (pred.length < 1) {
    throw new Error(`[${paradigm}] empty predicted_text`);
  }

  const d2 = step2?.detail && typeof step2.detail === "object" ? step2.detail : {};
  const d3 = step3?.detail && typeof step3.detail === "object" ? step3.detail : {};
  const d4 = step4?.detail && typeof step4.detail === "object" ? step4.detail : {};
  const fb2 = Array.isArray(d2.routing_fallbacks) ? d2.routing_fallbacks : [];
  const fb3 = Array.isArray(d3.routing_fallbacks) ? d3.routing_fallbacks : [];
  const fb4 = Array.isArray(d4.routing_fallbacks) ? d4.routing_fallbacks : [];
  if (fb3.length === 0 && fb4.length === 0) {
    throw new Error(`[${paradigm}] expected routing_fallbacks on step3 or step4`);
  }

  console.log(
    `[${paradigm}] OK intent=${intent.slice(0, 40)} pred=${pred.slice(0, 50)} step2=${step2?.status} fb2=${JSON.stringify(fb2)}`
  );
  return true;
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

  const paradigms = ["motor_imagery", "p300", "ssvep"];
  let ok = 0;
  for (const p of paradigms) {
    try {
      if (await runScenario(baseUrl, apiKey, p)) ok++;
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }

  console.log(`\n[OK] Completed ${ok}/${paradigms.length} paradigm scenarios.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
