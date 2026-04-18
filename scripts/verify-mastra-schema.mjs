/**
 * Verify Supabase/Postgres has the `mastra` schema (and optionally tables) for Mastra storage.
 *
 * Requires: `PI_CLI_DATABASE_URL` or `DATABASE_URL` in the environment (or `.env.local` loaded by you).
 *
 *   node scripts/verify-mastra-schema.mjs
 *
 * Exit codes:
 *   0 — schema exists (and at least one table when reachable)
 *   0 — skipped when no database URL configured
 *   1 — URL set but schema missing or connection failed
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

async function main() {
  loadEnvLocal();
  const url = process.env.PI_CLI_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("[SKIP] Set PI_CLI_DATABASE_URL (or DATABASE_URL) to verify mastra schema.\n");
    process.exit(0);
  }

  const fs = await import("node:fs");
  const path = await import("node:path");

  function loadCaPem() {
    const raw = process.env.PI_CLI_DATABASE_CA_BUNDLE?.trim();
    if (!raw) return undefined;
    if (raw.includes("BEGIN CERTIFICATE") || raw.includes("BEGIN TRUSTED CERTIFICATE")) {
      return raw.replace(/\\n/g, "\n");
    }
    try {
      const p = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
      return fs.readFileSync(p, "utf8");
    } catch {
      return undefined;
    }
  }

  const ca = loadCaPem();
  const relaxed = process.env.PI_CLI_DATABASE_SSL_REJECT_UNAUTHORIZED === "false";
  const ssl = ca ? { ca, rejectUnauthorized: true } : relaxed ? { rejectUnauthorized: false } : undefined;

  const { Client } = await import("pg");
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 8000,
    ...(ssl ? { ssl } : {}),
  });

  try {
    await client.connect();
    const { rows: schemas } = await client.query(
      `select schema_name from information_schema.schemata where schema_name = $1`,
      ["mastra"],
    );
    if (!schemas.length) {
      console.error("[FAIL] schema `mastra` does not exist. Run the SQL block in docs/cli/mastra-architecture.md.");
      process.exit(1);
    }
    const { rows: tables } = await client.query(
      `select count(*)::int as n from information_schema.tables where table_schema = 'mastra'`,
    );
    const n = tables[0]?.n ?? 0;
    if (n < 1) {
      console.warn("[WARN] schema mastra exists but has no tables yet (first workflow run creates them).");
    } else {
      console.log(`[OK] mastra schema present with ${n} table(s) in information_schema.`);
    }
  } catch (e) {
    console.error("[FAIL] Postgres:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
