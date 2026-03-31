/**
 * Surveillance API E2E (real HTTP + Unkey).
 *
 *   node scripts/surveillance-e2e.mjs
 *   PI_API_KEY=pi_... node scripts/surveillance-e2e.mjs
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

  let apiKey = process.env.PI_API_KEY?.trim();
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

  const streamBody = {
    stream_id: `e2e-${Date.now()}`,
    source: { url: "http://example.com/stream", type: "http" },
    detect: ["person"],
    behaviors: [{ type: "crowd_growth", zone: "global", count: 1, window_sec: 60 }],
    input: { data: `data:image/png;base64,${TINY_PNG_B64}`, mime_type: "image/png" },
    context: { site: "e2e" },
    output: { format: "json", include_diagnostics: true },
  };

  const postUrl = `${baseUrl}/api/v1/surveillance/streams`;
  console.log(`POST ${postUrl.replace(baseUrl, "")}`);
  const post = await fetchJson("POST", postUrl, { apiKey, body: streamBody });
  console.log(`  status: ${post.status}, ok: ${post.ok}`);
  console.log(`  body (truncated): ${post.rawText.slice(0, 600)}`);

  if (!post.ok || post.status !== 202) {
    console.error("\nFAIL: expected HTTP 202 Accepted with job envelope.");
    process.exit(1);
  }

  const jobId = post.json?.data?.job_id;
  if (!jobId) {
    console.error("FAIL: missing data.job_id");
    process.exit(1);
  }

  const getPath = `/api/v1/jobs/${jobId}?wait_for_completion=true&timeout_seconds=30&include=diagnostics`;
  console.log(`\nGET ${getPath}`);
  let job = await fetchJson("GET", `${baseUrl}${getPath}`, { apiKey });
  for (let poll = 0; poll < 8 && job.ok && job.json?.data?.status === "processing"; poll++) {
    await new Promise((r) => setTimeout(r, 1000));
    job = await fetchJson("GET", `${baseUrl}${getPath}`, { apiKey });
  }
  const st = job.json?.data?.status;
  console.log(`  job.status: ${st}`);
  if (st === "completed") {
    const out = job.json?.data?.payload?.output;
    if (out?.perception?.object === "surveillance.perception") {
      console.log(`\n[OK] Completed with perception stream_id=${out.stream_id}`);
    } else {
      console.log("\n[WARN] Completed but payload.output.perception shape unexpected.");
    }
  } else if (st === "failed") {
    console.log("\n[WARN] Job failed — check SURVEILLANCE_ORCHESTRATOR_URL, GEMINI_KEY, Trigger.dev.");
  } else {
    console.log("\n[WARN] Job not completed — worker may be offline or job still running.");
  }

  const policyBody = {
    stream_id: streamBody.stream_id,
    name: `e2e_policy_${Date.now()}`,
    type: "intrusion",
    condition: { zone: "global" },
    action: { severity: "warning", cooldown_seconds: 10 },
    enabled: true,
  };
  console.log(`\nPOST /api/v1/surveillance/policies`);
  const pol = await fetchJson("POST", `${baseUrl}/api/v1/surveillance/policies`, {
    apiKey,
    body: policyBody,
  });
  console.log(`  status: ${pol.status}, ok: ${pol.ok}`);
  if (!pol.ok) {
    console.error("FAIL: policy create");
    process.exit(1);
  }

  const list = await fetchJson(
    "GET",
    `${baseUrl}/api/v1/surveillance/policies?stream_id=${encodeURIComponent(streamBody.stream_id)}`,
    { apiKey }
  );
  console.log(`\nGET /api/v1/surveillance/policies?stream_id=... status=${list.status}`);
  const policies = list.json?.data?.policies;
  if (!Array.isArray(policies)) {
    console.error("FAIL: expected data.policies array");
    process.exit(1);
  }
  console.log(`[OK] policies count=${policies.length}`);

  console.log(`\n[OK] Surveillance E2E smoke finished.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
