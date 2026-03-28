/**
 * E2E ads generation check:
 * - mints a real Unkey Pi API key
 * - calls POST /api/v1/images/generations with non-English prompts
 * - polls GET /api/v1/jobs/:id until completed
 * - prints final image URL(s)
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
    throw new Error(`Unable to create API key: ${JSON.stringify(keyResp?.error ?? {})}`);
  }
  return {
    key: keyResp.data.key,
    keyId: keyResp.data.keyId ?? null,
  };
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function postJson(url, apiKey, body, idempotencyKey) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST failed ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function getJson(url, apiKey) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`GET failed ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function waitForJob(baseUrl, apiKey, jobId, timeoutMs = 5 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await getJson(
      // NOTE: the jobs endpoint currently accepts a single include/expand value.
      // We request diagnostics (full payload still returned because default fields="*").
      `${baseUrl}/api/v1/jobs/${jobId}?include=diagnostics`,
      apiKey
    );
    const status = job?.data?.status;
    if (status === "completed") return job;
    if (status === "failed") return job;
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

async function main() {
  loadEnvLocal();

  const baseUrl = process.env.PI_BASE_URL || "http://localhost:3000";
  const orgId =
    process.env.PROJECTION_GOLDEN_ORG_ID || "f99d39cb-d556-43b0-9d74-9c94c58b2574";

  if (!process.env.UNKEY_ROOT_KEY?.trim()) throw new Error("Missing UNKEY_ROOT_KEY");
  if (!process.env.UNKEY_API_ID?.trim()) throw new Error("Missing UNKEY_API_ID");

  const { Unkey } = await import("@unkey/api");
  const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });
  const { key: apiKey } = await createApiKey(unkey, orgId);

  const cases = [
    {
      name: "GENZ_girl_coke_ads",
      body: {
        prompt: "a gen z girl doing coke ads",
        output: { aspect_ratio: "4:5", resolution: "1K", thinking_intensity: "minimal" },
      },
    },
  ];

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Using minted Pi API key prefix: ${apiKey.slice(0, 8)}...`);

  for (const testCase of cases) {
    console.log(`\n=== CASE ${testCase.name} ===`);
    console.log("request_body:", JSON.stringify(testCase.body, null, 2));
    const queued = await postJson(
      `${baseUrl}/api/v1/images/generations`,
      apiKey,
      testCase.body,
      `${testCase.name}-${Date.now()}`
    );
    const jobId = queued?.data?.job_id;
    console.log("job_id:", jobId);
    console.log("queued_response:", JSON.stringify(queued, null, 2));

    const finalJob = await waitForJob(baseUrl, apiKey, jobId);
    console.log("status:", finalJob?.data?.status);
    console.log("image_url:", finalJob?.data?.ad?.image_url ?? finalJob?.data?.payload?.image_url);
    if (finalJob?.data?.status === "failed") {
      console.log("failure_code:", finalJob?.data?.payload?.failure_code ?? null);
      console.log("error_log:", finalJob?.data?.error_log ?? null);
    }

    const payload = finalJob?.data?.payload ?? {};
    console.log("payload_summary:", JSON.stringify({
      phase: payload.phase ?? null,
      has_corpus_reference: payload.has_corpus_reference ?? null,
      route_tier: payload.route_tier ?? null,
      evaluator: payload.evaluator ?? null,
      directive_version: payload.directive_version ?? null,
      retrieval_diagnostics: payload.retrieval_diagnostics ?? null,
    }, null, 2));

    if (payload?.diagnostics?.length) {
      console.log("diagnostics_steps:");
      for (const step of payload.diagnostics) {
        console.log(JSON.stringify(step, null, 2));
      }
    } else {
      console.log("diagnostics_steps: (none)");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

