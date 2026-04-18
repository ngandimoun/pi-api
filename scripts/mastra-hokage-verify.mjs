/**
 * Pi CLI Hokage / Mastra production verification (HTTP + optional authenticated flows).
 *
 * Phase A — public health (no API key):
 *   GET /api/cli/health → expects 200, ok:true, 22 workflows, 4 agents (parity with `tests/mastra/mastra-registry.test.ts`).
 *
 * Phase B — authenticated (runs when PI_API_KEY is set, or UNKEY_ROOT_KEY + UNKEY_API_ID to mint):
 *   - POST /api/cli/validate (sync workflow path)
 *   - POST /api/cli/validate?async=true + poll /api/cli/workflow/poll until terminal
 *   - POST /api/cli/routine/generate with require_approval (sync) → suspended + POST /api/cli/workflow/resume
 *   - Memory: two validates on same branch_name
 *   - Strict header: X-Pi-Fail-Closed: true on validate (expects 200 when workflow succeeds)
 *   - POST /api/cli/trace when a workflow run_id is available
 *
 * Usage:
 *   node scripts/mastra-hokage-verify.mjs
 *   PI_BASE_URL=https://your-app.vercel.app node scripts/mastra-hokage-verify.mjs
 *   MASTRA_HOKAGE_FULL=0 node scripts/mastra-hokage-verify.mjs   # health only (default if no API key path)
 *
 * Loads `.env.local` when present (same pattern as other scripts).
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

function resolveBaseUrl() {
  const raw =
    process.env.PI_BASE_URL?.trim() ||
    process.env.PI_CLI_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

async function fetchJson(method, url, { apiKey, headers = {}, body, timeoutMs = 120_000 } = {}) {
  const h = {
    Accept: "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...headers,
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };
  const res = await fetch(url, {
    method,
    headers: h,
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

async function resolveApiKey() {
  let apiKey = process.env.PI_API_KEY?.trim();
  if (apiKey) return apiKey;
  if (!process.env.UNKEY_ROOT_KEY?.trim() || !process.env.UNKEY_API_ID?.trim()) return null;
  const { Unkey } = await import("@unkey/api");
  const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });
  const orgId =
    process.env.HEALTH_E2E_ORG_ID?.trim() ||
    process.env.PROJECTION_GOLDEN_ORG_ID?.trim() ||
    process.env.VOICE_E2E_ORG_ID?.trim() ||
    "f99d39cb-d556-43b0-9d74-9c94c58b2574";
  return createApiKey(unkey, orgId);
}

async function pollWorkflow(baseUrl, apiKey, workflowKey, runId, { maxWaitMs = 120_000 } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < maxWaitMs) {
    last = await fetchJson("POST", `${baseUrl}/api/cli/workflow/poll`, {
      apiKey,
      body: { workflow_key: workflowKey, run_id: runId },
      timeoutMs: 60_000,
    });
    const st = last.json?.data?.status;
    if (last.ok && (st === "success" || st === "failed" || st === "suspended")) return last;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return last;
}

async function main() {
  loadEnvLocal();
  const baseUrl = resolveBaseUrl();
  const wantFull = process.env.MASTRA_HOKAGE_FULL !== "0" && process.env.MASTRA_HOKAGE_FULL !== "false";

  console.log(`\n[mastra-hokage-verify] Base URL: ${baseUrl}\n`);

  let health;
  try {
    health = await fetchJson("GET", `${baseUrl}/api/cli/health`, { timeoutMs: 15_000 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[SKIP] Health request failed (${msg}). Start the app or set PI_BASE_URL.`);
    console.warn("        Registry checks still run via: npx vitest run tests/mastra/mastra-registry.test.ts\n");
    process.exit(0);
  }

  if (!health.ok || health.status !== 200) {
    console.error("[FAIL] /api/cli/health not OK:", health.status, JSON.stringify(health.json).slice(0, 800));
    process.exit(1);
  }

  const h = health.json;
  if (!h?.ok) {
    console.error("[FAIL] health.ok is false:", JSON.stringify(h?.checks ?? {}).slice(0, 1200));
    process.exit(1);
  }

  const wfCount = Array.isArray(h.workflows) ? h.workflows.length : 0;
  const agCount = Array.isArray(h.agents) ? h.agents.length : 0;
  if (wfCount !== 22 || agCount !== 4) {
    console.error(`[FAIL] Expected 22 workflows and 4 agents, got workflows=${wfCount} agents=${agCount}`);
    process.exit(1);
  }

  console.log("[OK] Phase A: /api/cli/health production-ready (22 workflows, 4 agents).\n");

  if (!wantFull) {
    console.log("Tip: Phase B skipped (MASTRA_HOKAGE_FULL=0). Omit it or set to 1, plus PI_API_KEY (or Unkey), to run authenticated checks.\n");
    process.exit(0);
  }

  let apiKey;
  try {
    apiKey = await resolveApiKey();
  } catch (e) {
    console.warn("[SKIP] Phase B: could not resolve API key:", e instanceof Error ? e.message : e);
    process.exit(0);
  }
  if (!apiKey) {
    console.warn("[SKIP] Phase B: set PI_API_KEY or UNKEY_ROOT_KEY + UNKEY_API_ID.\n");
    process.exit(0);
  }

  const branch = `mhokage-verify-${Date.now()}`;
  let traceRunId;

  // Sync validate
  const v1 = await fetchJson("POST", `${baseUrl}/api/cli/validate`, {
    apiKey,
    body: {
      intent: "add read-only health endpoint",
      branch_name: branch,
      local_violations: [],
    },
  });
  if (!v1.ok || v1.status !== 200) {
    console.error("[FAIL] sync validate:", v1.status, v1.rawText?.slice(0, 600));
    process.exit(1);
  }
  if (!v1.json?.data?.semantic_violations) {
    console.error("[FAIL] sync validate missing data.semantic_violations");
    process.exit(1);
  }
  console.log("[OK] Phase B.1: sync /api/cli/validate (200).");

  // Strict success path (must not regress to silent failure hiding)
  const vStrict = await fetchJson("POST", `${baseUrl}/api/cli/validate`, {
    apiKey,
    headers: { "X-Pi-Fail-Closed": "true" },
    body: {
      intent: "document env-driven model selection",
      branch_name: branch,
      local_violations: [],
    },
  });
  if (!vStrict.ok || vStrict.status !== 200) {
    console.error("[FAIL] validate with X-Pi-Fail-Closed: true:", vStrict.status, vStrict.rawText?.slice(0, 600));
    process.exit(1);
  }
  console.log("[OK] Phase B.2: validate with X-Pi-Fail-Closed: true (200).");

  // Strict + invalid body → Zod 400 (fail-closed must not turn request validation into fake workflow success)
  const badBody = await fetchJson("POST", `${baseUrl}/api/cli/validate`, {
    apiKey,
    headers: { "X-Pi-Fail-Closed": "true" },
    body: { intent: "missing-local-violations-array" },
  });
  if (badBody.status !== 400) {
    console.error(
      "[FAIL] validate strict + invalid JSON schema expected 400, got:",
      badBody.status,
      badBody.rawText?.slice(0, 400),
    );
    process.exit(1);
  }
  console.log("[OK] Phase B.2b: strict + invalid body → 400 invalid_request (Zod).");

  // Memory follow-up
  const v2 = await fetchJson("POST", `${baseUrl}/api/cli/validate`, {
    apiKey,
    body: {
      intent: "extend prior intent with caching notes",
      branch_name: branch,
      local_violations: [],
    },
  });
  if (!v2.ok || v2.status !== 200) {
    console.error("[FAIL] second validate (memory path):", v2.status);
    process.exit(1);
  }
  console.log("[OK] Phase B.3: second validate on same branch (memory wiring).");

  // Async validate + poll
  const va = await fetchJson("POST", `${baseUrl}/api/cli/validate?async=true`, {
    apiKey,
    body: {
      intent: "async validate smoke",
      branch_name: branch,
      local_violations: [],
    },
    timeoutMs: 60_000,
  });
  if (!va.ok || va.status !== 202 || !va.json?.data?.run_id) {
    console.error("[FAIL] async validate:", va.status, va.rawText?.slice(0, 800));
    process.exit(1);
  }
  const runId = va.json.data.run_id;
  traceRunId = runId;
  console.log(`[..] Phase B.4: polling async validate run_id=${runId} ...`);
  const polled = await pollWorkflow(baseUrl, apiKey, "cliValidateWorkflow", runId);
  if (!polled?.ok || polled.json?.data?.status !== "success") {
    console.error("[FAIL] async validate poll:", polled?.status, JSON.stringify(polled?.json).slice(0, 1200));
    process.exit(1);
  }
  console.log("[OK] Phase B.4: async validate completed (success).");

  // Routine HITL sync + resume
  const r1 = await fetchJson("POST", `${baseUrl}/api/cli/routine/generate`, {
    apiKey,
    body: {
      intent: "add npm script for mastra verification",
      require_approval: true,
      branch_name: branch,
    },
    timeoutMs: 180_000,
  });
  if (!r1.ok || r1.status !== 200) {
    console.error("[FAIL] routine generate (expect 200 suspended):", r1.status, r1.rawText?.slice(0, 800));
    process.exit(1);
  }
  const d = r1.json?.data;
  if (d?.status !== "suspended" || !d?.run_id) {
    console.error("[FAIL] routine expected status suspended + run_id:", JSON.stringify(d).slice(0, 800));
    process.exit(1);
  }
  const routineRunId = d.run_id;
  const resume = await fetchJson("POST", `${baseUrl}/api/cli/workflow/resume`, {
    apiKey,
    body: {
      workflow_key: "cliRoutineWorkflow",
      run_id: routineRunId,
      resume_data: { approved: true },
    },
    timeoutMs: 180_000,
  });
  if (!resume.ok || resume.status !== 200) {
    console.error("[FAIL] workflow resume:", resume.status, resume.rawText?.slice(0, 800));
    process.exit(1);
  }
  console.log("[OK] Phase B.5: routine HITL suspend + resume.");

  // Trace
  if (traceRunId) {
    const tr = await fetchJson("POST", `${baseUrl}/api/cli/trace`, {
      apiKey,
      body: { run_id: traceRunId, workflow_key: "cliValidateWorkflow" },
    });
    if (!tr.ok || tr.status !== 200 || !tr.json?.data?.snapshot) {
      console.error("[FAIL] /api/cli/trace:", tr.status, tr.rawText?.slice(0, 600));
      process.exit(1);
    }
    console.log("[OK] Phase B.6: /api/cli/trace returned snapshot.");
  }

  console.log("\n[mastra-hokage-verify] All phases passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
