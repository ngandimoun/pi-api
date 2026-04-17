import { PgVector, PostgresStore } from "@mastra/pg";
import { parse } from "pg-connection-string";

let postgresStore: PostgresStore | null | undefined;
let pgVector: PgVector | null | undefined;

/** Vercel/dashboard paste often wraps the value in quotes — that breaks URL parsing downstream. */
function stripEnvValueQuotes(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Postgres connection for Mastra storage + workflow snapshots (time travel / resume).
 * Prefer PI_CLI_DATABASE_URL; fall back to DATABASE_URL for shared Supabase Postgres.
 */
export function getPiCliDatabaseUrl(): string | undefined {
  const stripBom = (s: string) => s.replace(/^\uFEFF/, "");
  const direct = process.env.PI_CLI_DATABASE_URL?.trim();
  if (direct) return stripBom(stripEnvValueQuotes(direct));
  const fallback = process.env.DATABASE_URL?.trim();
  return fallback ? stripBom(stripEnvValueQuotes(fallback)) : undefined;
}

/**
 * True while `next build` is running. Mastra's PostgresStore runs schema probes on init;
 * Vercel/CI often have missing or placeholder DB URLs, which surfaces as ERR_INVALID_URL /
 * MASTRA_STORAGE_PG_INIT_FAILED during "Collecting page data". Storage attaches at runtime instead.
 */
function isNextCompilerBuild(): boolean {
  if (process.env.FORCE_MASTRA_STORAGE_IN_BUILD === "true") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return true;
  if (process.env.NEXT_PHASE === "phase-development-build") return true;
  // Do not use `npm_lifecycle_event === "build"` here: some runtimes inherit it and would
  // incorrectly skip Postgres for every request (health would show not_configured).
  return false;
}

/**
 * Booleans only — for `/api/cli/health` when Postgres is down (never log the URL or password).
 */
export function getMastraPostgresConnectionDiagnostics(): {
  env_value_present: boolean;
  normalized_ok: boolean;
  canonical_parse_ok: boolean;
  deferred_during_next_build: boolean;
} {
  const raw = getPiCliDatabaseUrl();
  const normalized = raw ? normalizePostgresConnectionUrl(raw) : undefined;
  let canonicalParseOk = false;
  if (normalized) {
    try {
      const p = parse(normalized);
      canonicalParseOk = Boolean(p.host?.trim() && p.user);
    } catch {
      canonicalParseOk = false;
    }
  }
  return {
    env_value_present: Boolean(
      process.env.PI_CLI_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim(),
    ),
    normalized_ok: Boolean(normalized),
    canonical_parse_ok: canonicalParseOk,
    deferred_during_next_build: isNextCompilerBuild(),
  };
}

/**
 * Drop placeholder / malformed connection strings so we never pass junk into `pg` / @mastra/pg
 * (invalid values caused Vercel builds to log MASTRA_STORAGE_PG_INIT_FAILED with ERR_INVALID_URL).
 */
export function normalizePostgresConnectionUrl(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (/^<[^>]+>$/.test(t)) return undefined;
  if (/<DB_PASSWORD>/i.test(t) || /\[YOUR[-_ ]*PASSWORD\]/i.test(t)) return undefined;
  if (!/^postgres(?:ql)?:\/\//i.test(t)) return undefined;
  // Anything shorter is almost certainly incomplete (also avoids bad template URLs).
  if (t.length < 24) return undefined;

  try {
    const u = new URL(t);
    if (!u.hostname || u.hostname.length < 3) return undefined;
    // Broken template / parser witness seen on bad deploy envs
    if (u.hostname === "base") return undefined;
    return t;
  } catch {
    // Passwords may contain reserved URL characters unencoded — allow libpq-style user:pass@host:port/db
    if (/^postgres(?:ql)?:\/\/[^/?\s]+@[^/?\s]+(\/|\?)/i.test(t)) return t;
    return undefined;
  }
}

/**
 * Parse the URI with `pg-connection-string` (same as `node-postgres`), then build a **canonical**
 * connection string with an encoded user/password segment. This avoids `Invalid URL` from
 * `new URL(str, "postgres://base")` when passwords contain reserved characters or when `?schema=…`
 * is present (we pass `schema` to Mastra as `schemaName` and omit it from the string passed to `pg`).
 */
function toCanonicalPgConnectionString(normalizedUrl: string): { connectionString: string; schemaName?: string } | null {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(normalizedUrl);
  } catch (e) {
    console.warn("[mastra-storage] pg-connection-string parse failed:", e);
    return null;
  }

  const rawSchema = (parsed as { schema?: unknown }).schema;
  const schemaName =
    typeof rawSchema === "string" && rawSchema.trim().length > 0 ? rawSchema.trim() : undefined;

  const host = parsed.host?.trim();
  if (!host || !parsed.user) {
    console.warn("[mastra-storage] parsed connection missing host or user");
    return null;
  }

  const user = encodeURIComponent(parsed.user);
  const pass =
    parsed.password != null && String(parsed.password) !== ""
      ? `:${encodeURIComponent(String(parsed.password))}`
      : "";
  const port = String(parsed.port || "5432");
  const database = (parsed.database && String(parsed.database)) || "postgres";

  const qs = new URLSearchParams();
  if (parsed.sslmode) qs.set("sslmode", String(parsed.sslmode));
  if (
    (host.endsWith(".pooler.supabase.com") || host.includes("pooler.supabase.com") || host.endsWith(".supabase.co")) &&
    !qs.has("sslmode")
  ) {
    qs.set("sslmode", "require");
  }

  const qstr = qs.toString();
  const connectionString = `postgresql://${user}${pass}@${host}:${port}/${database}${qstr ? `?${qstr}` : ""}`;
  return { connectionString, ...(schemaName ? { schemaName } : {}) };
}

export function getMastraPostgresStore(): PostgresStore | null {
  const raw = getPiCliDatabaseUrl();
  const url = raw ? normalizePostgresConnectionUrl(raw) : undefined;
  if (!url) return null;
  if (isNextCompilerBuild()) return null;

  if (postgresStore === undefined) {
    try {
      const built = toCanonicalPgConnectionString(url);
      if (!built) {
        postgresStore = null;
      } else {
        postgresStore = new PostgresStore({
          id: "mastra-pi-cli-storage",
          connectionString: built.connectionString,
          ...(built.schemaName ? { schemaName: built.schemaName } : {}),
        });
      }
    } catch (e) {
      console.warn("[mastra-storage] PostgresStore constructor failed:", e);
      postgresStore = null;
    }
  }
  return postgresStore ?? null;
}

/**
 * pgvector store for Mastra Memory semantic recall (optional; requires embedder in Memory).
 */
export function getMastraPgVector(): PgVector | null {
  const raw = getPiCliDatabaseUrl();
  const url = raw ? normalizePostgresConnectionUrl(raw) : undefined;
  if (!url) return null;
  if (isNextCompilerBuild()) return null;

  if (pgVector === undefined) {
    try {
      const built = toCanonicalPgConnectionString(url);
      if (!built) {
        pgVector = null;
      } else {
        pgVector = new PgVector({
          id: "mastra-pi-cli-vector",
          connectionString: built.connectionString,
          ...(built.schemaName ? { schemaName: built.schemaName } : {}),
        });
      }
    } catch (e) {
      console.warn("[mastra-storage] PgVector constructor failed:", e);
      pgVector = null;
    }
  }
  return pgVector ?? null;
}
