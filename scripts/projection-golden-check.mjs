/**
 * Golden projection check: POST /api/v1/brands/:id/project for each prompt in
 * scripts/golden-projection-prompts.json and writes artifacts/projection-golden-check.json
 *
 * Metrics:
 * - deterministic_rate: share of responses with payload.meta.source === "deterministic_projection"
 *   (model path did not produce the payload; DNA-derived fallback).
 * - legacy_fallback_rate: meta.fallback or legacy reason strings (may overlap with deterministic).
 * - non_llm_rate: deterministic_path OR legacy_fallback — any non-LLM-success indicator.
 *
 * Pass thresholds (env):
 * - PROJECTION_GOLDEN_MAX_DETERMINISTIC_RATE (default "0") — pass if deterministic_rate <= this.
 *   Use "1" to allow 100% deterministic (disable strict LLM gate).
 * - PROJECTION_GOLDEN_MAX_NON_LLM_RATE — if set, pass if non_llm_rate <= this; else falls back to
 *   PROJECTION_GOLDEN_MAX_FALLBACK_RATE (default "0") for backward compatibility.
 * - PROJECTION_GOLDEN_MAX_P95_MS (default "15000")
 */
import fs from "node:fs";
import path from "path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
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

function validateProjectionEnvelope(body) {
  return (
    body &&
    typeof body === "object" &&
    body.object === "brand.projection" &&
    body.data &&
    typeof body.data === "object" &&
    typeof body.data.is_wildcard === "boolean" &&
    body.data.payload &&
    typeof body.data.payload === "object"
  );
}

function classifyProjectionMeta(body) {
  const meta = body?.data?.payload?.meta;
  const deterministicPath =
    meta && typeof meta === "object" && meta.source === "deterministic_projection";
  const legacyFallback =
    Boolean(meta?.fallback) || meta?.reason === "model_empty_or_invalid_json";
  const nonLlm = Boolean(deterministicPath || legacyFallback);
  return { deterministicPath, legacyFallback, nonLlm };
}

async function main() {
  loadEnvLocal();

  const promptsPath = path.resolve(process.cwd(), "scripts", "golden-projection-prompts.json");
  const prompts = JSON.parse(fs.readFileSync(promptsPath, "utf8"));
  if (!Array.isArray(prompts) || prompts.length === 0) {
    throw new Error("golden prompts file is empty or invalid");
  }

  const baseUrl = process.env.PI_BASE_URL || "http://localhost:3000";
  const brandId = process.env.PROJECTION_GOLDEN_BRAND_ID || "ae6fb558-8855-4148-b881-e0044d41cccd";
  const orgId = process.env.PROJECTION_GOLDEN_ORG_ID || "f99d39cb-d556-43b0-9d74-9c94c58b2574";
  const maxP95Ms = Number(process.env.PROJECTION_GOLDEN_MAX_P95_MS ?? "15000");
  const maxDeterministicRate = Number(process.env.PROJECTION_GOLDEN_MAX_DETERMINISTIC_RATE ?? "0");
  const maxNonLlmRate = Number(
    process.env.PROJECTION_GOLDEN_MAX_NON_LLM_RATE ??
      process.env.PROJECTION_GOLDEN_MAX_FALLBACK_RATE ??
      "0"
  );

  const { Unkey } = await import("@unkey/api");
  const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });
  const { key: apiKey, keyId } = await createApiKey(unkey, orgId);

  const results = [];
  const durations = [];
  let validEnvelopeCount = 0;
  let deterministicCount = 0;
  let legacyFallbackCount = 0;
  let nonLlmCount = 0;

  for (const prompt of prompts) {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/api/v1/brands/${brandId}/project`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ use_case: String(prompt.use_case ?? "") }),
    });
    const durationMs = Date.now() - start;
    durations.push(durationMs);

    const text = await response.text();
    let body = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }

    const validEnvelope = response.status === 200 && validateProjectionEnvelope(body);
    if (validEnvelope) {
      validEnvelopeCount += 1;
    }
    const { deterministicPath, legacyFallback, nonLlm } = classifyProjectionMeta(body);
    if (deterministicPath) {
      deterministicCount += 1;
    }
    if (legacyFallback) {
      legacyFallbackCount += 1;
    }
    if (nonLlm) {
      nonLlmCount += 1;
    }

    results.push({
      id: prompt.id,
      title: prompt.title,
      status: response.status,
      duration_ms: durationMs,
      valid_envelope: validEnvelope,
      deterministic_path: deterministicPath,
      legacy_fallback: legacyFallback,
      non_llm: nonLlm,
      request_id: body?.id ?? body?.error?.request_id ?? null,
    });
  }

  const n = prompts.length;
  const deterministicRate = n > 0 ? deterministicCount / n : 1;
  const legacyFallbackRate = n > 0 ? legacyFallbackCount / n : 1;
  const nonLlmRate = n > 0 ? nonLlmCount / n : 1;
  const p95Ms = percentile(durations, 95);
  const validJsonRate = n > 0 ? validEnvelopeCount / n : 0;

  const passDeterministic = deterministicRate <= maxDeterministicRate;
  const passNonLlm = nonLlmRate <= maxNonLlmRate;

  const summary = {
    timestamp: new Date().toISOString(),
    base_url: baseUrl,
    brand_id: brandId,
    org_id: orgId,
    key_id: keyId,
    thresholds: {
      max_deterministic_rate: maxDeterministicRate,
      max_non_llm_rate: maxNonLlmRate,
      max_p95_ms: maxP95Ms,
      required_valid_json_rate: 1,
    },
    metrics: {
      total_prompts: n,
      valid_json_rate: validJsonRate,
      deterministic_rate: deterministicRate,
      legacy_fallback_rate: legacyFallbackRate,
      non_llm_rate: nonLlmRate,
      p95_latency_ms: p95Ms,
    },
    pass: {
      valid_json_rate: validJsonRate >= 1,
      deterministic_gate: passDeterministic,
      non_llm_gate: passNonLlm,
      p95_latency_ms: p95Ms <= maxP95Ms,
    },
    results,
  };

  fs.mkdirSync(path.resolve(process.cwd(), "artifacts"), { recursive: true });
  const artifactPath = path.resolve(process.cwd(), "artifacts", "projection-golden-check.json");
  fs.writeFileSync(artifactPath, JSON.stringify(summary, null, 2));

  console.info(
    JSON.stringify(
      {
        saved: "artifacts/projection-golden-check.json",
        pass: summary.pass,
        metrics: summary.metrics,
      },
      null,
      2
    )
  );

  if (
    !summary.pass.valid_json_rate ||
    !summary.pass.deterministic_gate ||
    !summary.pass.non_llm_gate ||
    !summary.pass.p95_latency_ms
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("projection-golden-check failed:", error?.message ?? String(error));
  process.exit(1);
});
