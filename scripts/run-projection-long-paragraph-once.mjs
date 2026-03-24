import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key.startsWith("GOOGLE_BRAND_PROJECTION_")) process.env[key] = value;
    else if (!(key in process.env)) process.env[key] = value;
  }
}

function projectionEnvFromDotLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key.startsWith("GOOGLE_BRAND_PROJECTION_")) continue;
    out[key] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const sourcePath = path.resolve(
    process.cwd(),
    "artifacts",
    "brand-project-exact-raw-paragraph.json"
  );
  if (!fs.existsSync(sourcePath)) {
    console.error("Missing", sourcePath);
    process.exit(1);
  }
  const prior = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const useCase = prior.request?.use_case;
  if (!useCase || typeof useCase !== "string") {
    console.error("No request.use_case in source artifact");
    process.exit(1);
  }

  const baseUrl = process.env.PI_BASE_URL || "http://localhost:3000";
  const brandId =
    process.env.PROJECTION_LONG_PARAGRAPH_BRAND_ID || prior.brandId || "ae6fb558-8855-4148-b881-e0044d41cccd";
  const orgId = process.env.PROJECTION_LONG_PARAGRAPH_ORG_ID || prior.orgId;

  const { Unkey } = await import("@unkey/api");
  const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });
  const keyResp = await unkey.keys.createKey({
    apiId: process.env.UNKEY_API_ID,
    prefix: "pi",
    byteLength: 24,
    ownerId: orgId,
    enabled: true,
    meta: { organization_id: orgId },
  });
  if (keyResp?.error || !keyResp?.data?.key) {
    throw new Error("createKey failed: " + JSON.stringify(keyResp?.error ?? {}));
  }
  const apiKey = keyResp.data.key;
  const keyId = keyResp.data.keyId ?? null;

  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/api/v1/brands/${brandId}/project`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ use_case: useCase }),
  });
  const latencyMs = Date.now() - t0;
  const text = await res.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  const payload = body?.data?.payload;
  const meta = payload?.meta;
  const deterministic =
    meta?.source === "deterministic_projection" ||
    Boolean(meta?.fallback && meta?.reason === "model_unavailable_or_invalid_json");

  const out = {
    timestamp: new Date().toISOString(),
    tuning_note:
      "Uses exact request.use_case from artifacts/brand-project-exact-raw-paragraph.json (line breaks preserved in JSON string).",
    baseUrl,
    brandId,
    orgId,
    keyId,
    projection_env: {
      from_dotenv_local: projectionEnvFromDotLocal(),
      note: "Next.js server must be restarted to pick up .env.local changes; values below are what this repo’s .env.local defines for projection.",
    },
    request: { use_case: useCase, use_case_length: useCase.length },
    response: {
      status: res.status,
      latency_ms: latencyMs,
      body,
    },
    analysis: {
      valid_envelope: res.status === 200 && body?.object === "brand.projection",
      payload_meta: meta ?? null,
      deterministic_path: deterministic,
    },
  };

  fs.mkdirSync(path.resolve(process.cwd(), "artifacts"), { recursive: true });
  const outPath = path.resolve(
    process.cwd(),
    "artifacts",
    "brand-project-tuned-long-paragraph-final.json"
  );
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    JSON.stringify(
      {
        saved: outPath,
        status: res.status,
        latency_ms: latencyMs,
        object: body?.object ?? null,
        deterministic_path: deterministic,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
