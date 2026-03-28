/**
 * Voice API E2E checklist (real HTTP against Pi + optional Unkey key mint).
 *
 * What success looks like:
 * - Steps 1–5: agent CRUD + list (needs only running API + Supabase + valid org on the key).
 * - Step 6: session start needs LIVEKIT_* + GEMINI_KEY (or GOOGLE_GENERATIVE_AI_API_KEY).
 * - Step 7–8: GET session + complete need step 6; complete also needs a text model for extraction
 *   (GOOGLE_CAMPAIGN_ORCHESTRATOR_MODEL / GOOGLE_ADS_ORCHESTRATOR_MODEL / GOOGLE_DEFAULT_MODEL).
 *
 * Run (dev server on PI_BASE_URL):
 *   node scripts/voice-api-e2e.mjs
 *
 * Or use an existing Pi API key (skip Unkey mint):
 *   PI_VOICE_API_KEY=pi_... node scripts/voice-api-e2e.mjs
 *
 * Skip expensive / infra-heavy steps:
 *   VOICE_E2E_SKIP_SESSION=1 node scripts/voice-api-e2e.mjs
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

/** Developer-style voice agent payload (matches Zod in src/contracts/voice-agent-api.ts). */
const VOICE_AGENT_DEV_PAYLOAD = {
  name: "E2E Voice Support Agent",
  language: "en-US",
  purpose: "Help developers test billing and API questions in a short voice call.",
  instructions: `You are Pi's voice support agent for API customers.
- Keep replies short (1–2 sentences) unless the user asks for detail.
- Confirm what they need, then give one clear next step.
- Do not invent invoice numbers or promises; stay factual.`,
  questions: [
    {
      key: "issue_type",
      ask: "Is this about billing, the API, or something else?",
      type: "enum",
      options: ["billing", "api", "other"],
    },
    {
      key: "account_hint",
      ask: "Do you have an org id or request id from a recent error?",
      type: "text",
    },
  ],
  behaviors: {
    greeting: "Hi, this is Pi API support. What do you need help with?",
    tone: "professional",
    max_duration_seconds: 300,
    allow_interruptions: true,
    end_conversation_after_questions: false,
  },
  output_schema: {
    issue_type: "text",
    summary: "text",
    intent: "enum:billing,api,general",
  },
  voice: { name: "Kore" },
  metadata: { source: "scripts/voice-api-e2e.mjs" },
};

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
  return { key: keyResp.data.key, keyId: keyResp.data.keyId ?? null };
}

/**
 * @returns {{ ok: boolean, status: number, json: unknown, rawText: string, parseError?: string, timedOut?: boolean }}
 */
async function fetchJson(method, url, { apiKey, body, timeoutMs = 120_000 } = {}) {
  const headers = {
    Accept: "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };
  const shortUrl = url.replace(/^https?:\/\/[^/]+/, "");
  console.log(`    → ${method} ${shortUrl} (timeout ${timeoutMs / 1000}s)`);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    const name = e && typeof e === "object" && "name" in e ? String(e.name) : "";
    if (name === "AbortError" || name === "TimeoutError") {
      return {
        ok: false,
        status: 0,
        json: null,
        rawText: "",
        parseError: `request timed out after ${timeoutMs}ms`,
        timedOut: true,
      };
    }
    const cause = e && typeof e === "object" && "cause" in e ? e.cause : undefined;
    const code =
      cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "ECONNREFUSED" || /fetch failed|ECONNREFUSED/i.test(msg)) {
      return {
        ok: false,
        status: 0,
        json: null,
        rawText: "",
        parseError: `cannot reach API (${msg}). Is Next.js running? Try: PI_BASE_URL=http://localhost:<port> npm run voice:e2e`,
        networkError: true,
      };
    }
    throw e;
  }
  const rawText = await res.text();
  let json;
  let parseError;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
    json = null;
  }
  return { ok: res.ok, status: res.status, json, rawText, parseError };
}

async function main() {
  loadEnvLocal();

  const baseUrl = (process.env.PI_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const orgId =
    process.env.VOICE_E2E_ORG_ID?.trim() ||
    process.env.PROJECTION_GOLDEN_ORG_ID?.trim() ||
    "f99d39cb-d556-43b0-9d74-9c94c58b2574";

  const skipSession = process.env.VOICE_E2E_SKIP_SESSION === "1";
  const skipComplete = process.env.VOICE_E2E_SKIP_COMPLETE === "1";

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Org: ${orgId}`);
  console.log(`Skip session: ${skipSession}, skip complete: ${skipComplete}\n`);

  const results = [];

  function record(step, status, detail) {
    results.push({ step, status, detail });
    const icon = status === "pass" ? "OK " : status === "skip" ? "SKIP" : status === "warn" ? "WARN" : "FAIL";
    console.log(`[${icon}] ${step}${detail ? `: ${detail}` : ""}`);
  }

  let apiKey = process.env.PI_VOICE_API_KEY?.trim();
  if (!apiKey) {
    if (!process.env.UNKEY_ROOT_KEY?.trim()) {
      console.error("Need PI_VOICE_API_KEY or UNKEY_ROOT_KEY + UNKEY_API_ID to mint a key.");
      process.exit(1);
    }
    if (!process.env.UNKEY_API_ID?.trim()) {
      console.error("Missing UNKEY_API_ID (required to mint PI key).");
      process.exit(1);
    }
    const { Unkey } = await import("@unkey/api");
    const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });
    const minted = await createApiKey(unkey, orgId);
    apiKey = minted.key;
    record("unkey_mint", "pass", `key prefix ${apiKey.slice(0, 12)}... org ${orgId}`);
  } else {
    record("unkey_mint", "skip", "using PI_VOICE_API_KEY");
  }

  // --- 1) Create agent ---
  const createUrl = `${baseUrl}/api/v1/voice/agents`;
  let r1 = await fetchJson("POST", createUrl, { apiKey, body: VOICE_AGENT_DEV_PAYLOAD });
  if (r1.timedOut || r1.networkError) {
    record("POST /voice/agents", "fail", r1.parseError || "timeout");
    process.exit(1);
  }
  if (r1.parseError) {
    record("POST /voice/agents", "fail", `non-JSON body (${r1.status}): ${r1.parseError}`);
    console.error(r1.rawText.slice(0, 500));
    process.exit(1);
  }
  if (!r1.ok || r1.status !== 200) {
    record("POST /voice/agents", "fail", `HTTP ${r1.status}`);
    console.error(JSON.stringify(r1.json, null, 2));
    process.exit(1);
  }
  const agentId = r1.json?.data?.agent_id;
  if (!agentId || typeof agentId !== "string") {
    record("POST /voice/agents", "fail", "silent/structural: missing data.agent_id in 200 body");
    console.error(JSON.stringify(r1.json, null, 2));
    process.exit(1);
  }
  record("POST /voice/agents", "pass", `agent_id=${agentId}`);

  // Silent error: 200 but wrong envelope
  if (r1.json?.error) {
    record("POST /voice/agents", "warn", "response includes top-level `error` despite ok status (unexpected)");
  }

  // --- 2) List agents ---
  const r2 = await fetchJson("GET", `${baseUrl}/api/v1/voice/agents?limit=5`, { apiKey });
  if (r2.timedOut) {
    record("GET /voice/agents", "fail", r2.parseError || "timeout");
    process.exit(1);
  }
  if (!r2.ok || r2.status !== 200) {
    record("GET /voice/agents", "fail", `HTTP ${r2.status} ${JSON.stringify(r2.json)}`);
    process.exit(1);
  }
  const list = r2.json?.data?.data;
  if (!Array.isArray(list)) {
    record("GET /voice/agents", "fail", "silent/structural: data.data is not an array");
    process.exit(1);
  }
  const found = list.some((row) => row?.agent_id === agentId);
  if (!found) {
    record("GET /voice/agents", "warn", "new agent not in first page (may be pagination/order)");
  } else {
    record("GET /voice/agents", "pass", `found agent in list (${list.length} rows)`);
  }

  // --- 3) Get agent ---
  const r3 = await fetchJson("GET", `${baseUrl}/api/v1/voice/agents/${agentId}`, { apiKey });
  if (r3.timedOut) {
    record("GET /voice/agents/:id", "fail", r3.parseError || "timeout");
    process.exit(1);
  }
  if (!r3.ok || r3.status !== 200) {
    record("GET /voice/agents/:id", "fail", `HTTP ${r3.status}`);
    console.error(JSON.stringify(r3.json, null, 2));
    process.exit(1);
  }
  if (r3.json?.data?.agent_id !== agentId) {
    record("GET /voice/agents/:id", "fail", "silent/structural: data.agent_id mismatch");
    process.exit(1);
  }
  record("GET /voice/agents/:id", "pass", "instructions + questions present");
  if (!r3.json?.data?.instructions) {
    record("GET /voice/agents/:id", "warn", "missing data.instructions");
  }

  let sessionId = null;

  if (skipSession) {
    record("POST /voice/sessions", "skip", "VOICE_E2E_SKIP_SESSION=1");
  } else {
    const sessionBody = {
      agent_id: agentId,
      participant: { identity: `e2e_${Date.now()}`, name: "E2E Script" },
      ttl_seconds: 600,
      max_duration_seconds: 300,
      context: { script: "voice-api-e2e", org_hint: orgId },
    };
    const r4 = await fetchJson("POST", `${baseUrl}/api/v1/voice/sessions`, {
      apiKey,
      body: sessionBody,
      timeoutMs: 180_000,
    });
    if (r4.timedOut) {
      record("POST /voice/sessions", "fail", r4.parseError || "timeout (LiveKit + Gemini ephemeral can be slow)");
      process.exit(1);
    }
    if (r4.parseError) {
      record("POST /voice/sessions", "fail", `non-JSON: ${r4.parseError}`);
      process.exit(1);
    }
    if (r4.status !== 201) {
      record("POST /voice/sessions", "fail", `HTTP ${r4.status} (expected 201)`);
      console.error(JSON.stringify(r4.json, null, 2));
      console.error("\nHints: check LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GEMINI_KEY / GOOGLE_GENERATIVE_AI_API_KEY");
      process.exit(1);
    }
    if (r4.json?.status !== "active") {
      record("POST /voice/sessions", "fail", `silent/structural: top-level status not "active" (got ${JSON.stringify(r4.json?.status)})`);
      process.exit(1);
    }
    sessionId = r4.json?.data?.session_id;
    const lk = r4.json?.data?.connection?.livekit;
    const gl = r4.json?.data?.connection?.gemini_live;
    if (!sessionId) {
      record("POST /voice/sessions", "fail", "silent/structural: missing data.session_id");
      process.exit(1);
    }
    if (!lk?.url || !lk?.token) {
      record("POST /voice/sessions", "fail", "silent/structural: missing connection.livekit url/token");
      process.exit(1);
    }
    if (!gl?.url || !gl?.token) {
      record("POST /voice/sessions", "fail", "silent/structural: missing connection.gemini_live url/token");
      process.exit(1);
    }
    if (r4.json?.data?.max_duration_seconds !== 300) {
      record(
        "POST /voice/sessions",
        "warn",
        `expected max_duration_seconds 300, got ${JSON.stringify(r4.json?.data?.max_duration_seconds)}`
      );
    } else {
      record("POST /voice/sessions", "pass", `session_id=${sessionId} dual connection OK`);
    }
    if (r4.json?.error) {
      record("POST /voice/sessions", "warn", "top-level `error` present despite 201");
    }

    // --- GET session ---
    const r5 = await fetchJson("GET", `${baseUrl}/api/v1/voice/sessions/${sessionId}`, { apiKey });
    if (r5.timedOut) {
      record("GET /voice/sessions/:id", "fail", r5.parseError || "timeout");
      process.exit(1);
    }
    if (!r5.ok || r5.status !== 200) {
      record("GET /voice/sessions/:id", "fail", `HTTP ${r5.status}`);
      console.error(JSON.stringify(r5.json, null, 2));
      process.exit(1);
    }
    if (r5.json?.data?.session_id !== sessionId || r5.json?.data?.status !== "active") {
      record("GET /voice/sessions/:id", "fail", "silent/structural: wrong session_id or status");
      process.exit(1);
    }
    record("GET /voice/sessions/:id", "pass", `status=${r5.json?.data?.status}`);

    if (skipComplete) {
      record("POST /voice/sessions/:id/complete", "skip", "VOICE_E2E_SKIP_COMPLETE=1");
    } else {
      const completeBody = {
        transcript: [
          { role: "user", text: "I have a billing question about my last invoice." },
          {
            role: "agent",
            text: "I can help with billing. Do you have your organization id or a request id from an error message?",
          },
        ],
        duration_seconds: 45,
      };
      const r6 = await fetchJson("POST", `${baseUrl}/api/v1/voice/sessions/${sessionId}/complete`, {
        apiKey,
        body: completeBody,
        timeoutMs: 180_000,
      });
      if (r6.timedOut) {
        record("POST /voice/sessions/:id/complete", "fail", r6.parseError || "timeout");
        process.exit(1);
      }
      if (!r6.ok || r6.status !== 200) {
        record("POST /voice/sessions/:id/complete", "fail", `HTTP ${r6.status}`);
        console.error(JSON.stringify(r6.json, null, 2));
        console.error(
          "\nHints: set GOOGLE_CAMPAIGN_ORCHESTRATOR_MODEL or GOOGLE_ADS_ORCHESTRATOR_MODEL or GOOGLE_DEFAULT_MODEL + GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_KEY"
        );
        process.exit(1);
      }
      if (r6.json?.data?.status !== "completed") {
        record("POST /voice/sessions/:id/complete", "fail", `expected status completed, got ${JSON.stringify(r6.json?.data?.status)}`);
        process.exit(1);
      }
      if (r6.json?.data?.results == null) {
        record("POST /voice/sessions/:id/complete", "warn", "results is null (check output_schema / extraction)");
      } else {
        record("POST /voice/sessions/:id/complete", "pass", `results keys: ${Object.keys(r6.json.data.results || {}).join(",")}`);
      }
    }
  }

  // --- Negative: bad session complete (409) ---
  if (sessionId && !skipSession && !skipComplete) {
    const r7 = await fetchJson(
      "POST",
      `${baseUrl}/api/v1/voice/sessions/${sessionId}/complete`,
      {
        apiKey,
        body: { transcript: [{ role: "user", text: "again" }] },
        timeoutMs: 60_000,
      }
    );
    if (r7.timedOut) {
      record("POST complete twice (expect 409)", "warn", "timeout on second complete");
    } else if (r7.status !== 409) {
      record("POST complete twice (expect 409)", "warn", `got ${r7.status} instead of 409`);
    } else {
      record("POST complete twice (expect 409)", "pass", "voice_session_not_active");
    }
  } else {
    record("POST complete twice (expect 409)", "skip", "no completed session");
  }

  console.log("\n--- Summary ---");
  for (const row of results) {
    console.log(`${row.status.toUpperCase().padEnd(4)} ${row.step}`);
  }
  console.log("\nAgent JSON body is defined as VOICE_AGENT_DEV_PAYLOAD at the top of scripts/voice-api-e2e.mjs.");
  console.log("Success = all steps OK or SKIP as intended; no FAIL lines.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
