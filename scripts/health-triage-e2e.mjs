/**
 * Health triage API E2E (real HTTP + Unkey).
 *
 * Run with Next.js dev server:
 *   node scripts/health-triage-e2e.mjs
 *
 * Or pass key explicitly (no mint):
 *   PI_API_KEY=pi_... node scripts/health-triage-e2e.mjs
 *
 * Mint key from Unkey (needs UNKEY_ROOT_KEY + UNKEY_API_ID + org in meta):
 *   node scripts/health-triage-e2e.mjs
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

async function main() {
  loadEnvLocal();

  const baseUrl = (process.env.PI_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const orgId =
    process.env.HEALTH_E2E_ORG_ID?.trim() ||
    process.env.PROJECTION_GOLDEN_ORG_ID?.trim() ||
    process.env.VOICE_E2E_ORG_ID?.trim() ||
    "f99d39cb-d556-43b0-9d74-9c94c58b2574";

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Org (for Unkey mint): ${orgId}\n`);

  let apiKey = process.env.PI_API_KEY?.trim() || process.env.PI_HEALTH_API_KEY?.trim();
  if (!apiKey) {
    if (!process.env.UNKEY_ROOT_KEY?.trim() || !process.env.UNKEY_API_ID?.trim()) {
      console.error("Set PI_API_KEY or UNKEY_ROOT_KEY + UNKEY_API_ID to mint a key.");
      process.exit(1);
    }
    const { Unkey } = await import("@unkey/api");
    const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });
    apiKey = await createApiKey(unkey, orgId);
    console.log(`[OK] Minted API key (prefix ${apiKey.slice(0, 12)}...)\n`);
  } else {
    console.log(`[OK] Using PI_API_KEY from env\n`);
  }

  const healthBody = {
    input: {
      type: "image",
      data: `data:image/png;base64,${TINY_PNG_B64}`,
      modality: "xray",
      mime_type: "image/png",
    },
    context: { locale: "en", symptoms: "e2e smoke test" },
    output: { format: "json", include_diagnostics: true },
  };

  const postUrl = `${baseUrl}/api/v1/health/analyze`;
  console.log(`POST ${postUrl.replace(baseUrl, "")}`);
  const post = await fetchJson("POST", postUrl, { apiKey, body: healthBody });
  console.log(`  status: ${post.status}, ok: ${post.ok}`);
  console.log(`  body (truncated): ${post.rawText.slice(0, 800)}`);

  if (!post.ok || post.status !== 202) {
    console.error("\nFAIL: expected HTTP 202 Accepted with job envelope.");
    process.exit(1);
  }

  const jobId = post.json?.data?.job_id;
  if (!jobId) {
    console.error("FAIL: missing data.job_id");
    process.exit(1);
  }

  // Jobs route caps timeout_seconds at 30; poll again if the workflow needs longer.
  const getPath = `/api/v1/jobs/${jobId}?wait_for_completion=true&timeout_seconds=30&include=diagnostics`;
  console.log(`\nGET ${getPath}`);
  let job = await fetchJson("GET", `${baseUrl}${getPath}`, { apiKey });
  /** API caps long-poll at 30s; chain polls for slow Mastra + Gemini runs. */
  for (let poll = 0; poll < 5 && job.ok && job.json?.data?.status === "processing"; poll++) {
    await new Promise((r) => setTimeout(r, 500));
    job = await fetchJson("GET", `${baseUrl}${getPath}`, { apiKey });
  }
  console.log(`  status: ${job.status}, ok: ${job.ok}`);
  const data = job.json?.data;
  const st = data?.status;
  console.log(`  job.status: ${st}`);
  if (data?.payload) {
    const phase = data.payload.phase;
    const diagCount = Array.isArray(data.payload.diagnostics) ? data.payload.diagnostics.length : 0;
    console.log(`  payload.phase: ${phase ?? "(none)"}`);
    console.log(`  payload.diagnostics count: ${diagCount}`);
    if (diagCount > 0 && data.payload.diagnostics[0]) {
      console.log(`  first diagnostic step: ${JSON.stringify(data.payload.diagnostics[0]).slice(0, 200)}`);
    }
  }
  if (data?.error_log) {
    console.log(`  error_log: ${String(data.error_log).slice(0, 500)}`);
  }

  console.log(`\nRaw job response (truncated 2000 chars):\n${job.rawText.slice(0, 2000)}`);

  if (st === "queued") {
    console.log(
      "\n[WARN] Job still queued after long-poll — Trigger.dev worker may not be running or task not delivered."
    );
    process.exit(0);
  }
  if (st === "failed") {
    console.log("\n[WARN] Job failed — check error_log and Trigger.dev dashboard.");
    process.exit(0);
  }
  if (st !== "queued" && st !== "failed" && st !== "completed") {
    console.log(
      `\n[WARN] Job status is "${st}" after long-poll — increase timeout or retry GET (workflow may still be running).`
    );
    process.exit(0);
  }
  if (st === "completed") {
    const out = data?.payload?.output;
    const diagnostics = data?.payload?.diagnostics ?? [];
    if (!out?.triage_level) {
      console.log("\n[WARN] completed but payload.output missing triage_level (unexpected shape).");
    } else {
      console.log(`\n[OK] Completed triage_level=${out.triage_level} confidence=${out.confidence}`);
    }

    const step3 = diagnostics.find((d) => d?.step === "step3_clinical_interpretation");
    const step4 = diagnostics.find((d) => d?.step === "step4_treatment_plan");
    if (step3?.status !== "ok") {
      console.error(`\nFAIL: expected step3_clinical_interpretation status ok, got ${step3?.status}`);
      process.exit(1);
    }
    if (step4?.status !== "ok") {
      console.error(`\nFAIL: expected step4_treatment_plan status ok, got ${step4?.status}`);
      process.exit(1);
    }
    const planText = typeof out?.treatment_plan === "string" ? out.treatment_plan.trim() : "";
    if (planText.length < 20 || planText.includes("Treatment plan unavailable")) {
      console.error("\nFAIL: expected a real treatment_plan string from the pipeline.");
      process.exit(1);
    }
    const findings = Array.isArray(out?.findings) ? out.findings : [];
    if (findings.length === 0) {
      console.error("\nFAIL: expected non-empty findings array.");
      process.exit(1);
    }
    const s3detail = step3?.detail && typeof step3.detail === "object" ? step3.detail : {};
    const s4detail = step4?.detail && typeof step4.detail === "object" ? step4.detail : {};
    const fb3 = Array.isArray(s3detail.routing_fallbacks) ? s3detail.routing_fallbacks : null;
    const fb4 = Array.isArray(s4detail.routing_fallbacks) ? s4detail.routing_fallbacks : null;
    if (fb3 === null || fb4 === null) {
      console.error("\nFAIL: expected routing_fallbacks arrays in step3 and step4 diagnostics detail.");
      process.exit(1);
    }
    console.log(`\n[OK] Step3/4 diagnostics ok; findings=${findings.length}; plan length=${planText.length}`);
    console.log(`  step3 routing_fallbacks: ${JSON.stringify(fb3 ?? [])}`);
    console.log(`  step4 routing_fallbacks: ${JSON.stringify(fb4 ?? [])}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
