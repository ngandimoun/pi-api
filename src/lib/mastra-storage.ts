import { PgVector, PostgresStore } from "@mastra/pg";
import { parse } from "pg-connection-string";

let postgresStore: PostgresStore | null | undefined;
let pgVector: PgVector | null | undefined;

/** Set when PostgresStore init fails; safe to surface in /api/cli/health (no secrets). */
let lastPostgresStoreInitError: string | undefined;

const NEWLINE_EDGE = /^[\r\n]+|[\r\n]+$/g;
const UNICODE_EDGE = /^[\u00A0\u200B]+|[\u00A0\u200B]+$/g;
/** ASCII controls at edges only (do not strip interior password bytes). */
const CTRL_EDGE = /^[\u0000-\u001F\u007F]+|[\u0000-\u001F\u007F]+$/g;

/**
 * Normalizes common Vercel / shell pastes: `export VAR=`, stray quotes, BOM, CR, NBSP, ZWSP.
 * Only trims edges — never mutates the interior of the connection string.
 */
export function sanitizePastedDatabaseUrl(raw: string): string {
  let s = raw.replace(/^\uFEFF/, "").trim();
  s = s.replace(/^(?:export|set)\s+/i, "").trim();
  s = s.replace(/^(?:PI_CLI_DATABASE_URL|DATABASE_URL)=/i, "").trim();
  for (;;) {
    const prev = s;
    s = s.replace(NEWLINE_EDGE, "").trim();
    s = s.replace(UNICODE_EDGE, "").trim();
    s = s.replace(CTRL_EDGE, "").trim();
    while (s.length && /^["']/.test(s)) {
      s = s.slice(1);
      s = s.trimStart();
    }
    while (s.length && /["']$/.test(s)) {
      s = s.slice(0, -1);
      s = s.trimEnd();
    }
    if (s === prev) break;
  }
  return s.trim();
}

export type PiCliDatabaseEnvSource = "PI_CLI_DATABASE_URL" | "DATABASE_URL" | "none";

/**
 * Which env var actually supplies `getPiCliDatabaseUrl()` after sanitize
 * (PI wins only if it trims non-empty **and** sanitizes to a non-empty string).
 */
export function getPiCliDatabaseEnvSource(): PiCliDatabaseEnvSource {
  const pi = process.env.PI_CLI_DATABASE_URL;
  if (pi?.trim()) {
    const s = sanitizePastedDatabaseUrl(pi);
    if (s) return "PI_CLI_DATABASE_URL";
  }
  const db = process.env.DATABASE_URL;
  if (db?.trim()) {
    const s = sanitizePastedDatabaseUrl(db);
    if (s) return "DATABASE_URL";
  }
  return "none";
}

/**
 * Postgres connection for Mastra storage + workflow snapshots (time travel / resume).
 * Prefer PI_CLI_DATABASE_URL; fall back to DATABASE_URL for shared Supabase Postgres.
 */
export function getPiCliDatabaseUrl(): string | undefined {
  const pi = process.env.PI_CLI_DATABASE_URL;
  if (pi?.trim()) {
    const s = sanitizePastedDatabaseUrl(pi);
    return s || undefined;
  }
  const db = process.env.DATABASE_URL;
  if (db?.trim()) {
    const s = sanitizePastedDatabaseUrl(db);
    return s || undefined;
  }
  return undefined;
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

export function getLastPostgresStoreInitError(): string | undefined {
  return lastPostgresStoreInitError;
}

/** Secret-safe breakdown of why a URL was rejected (no URL body or password). */
export type PostgresUrlAnalysisFlags = {
  raw_length: number;
  trimmed_nonempty: boolean;
  has_placeholder: boolean;
  angle_template: boolean;
  scheme_ok: boolean;
  length_ok: boolean;
  whatwg_url_ok: boolean;
  pg_parse_ok: boolean;
  regex_fallback_ok: boolean;
  hostname_is_base: boolean;
};

export type PostgresUrlAnalysis = {
  ok: boolean;
  url?: string;
  flags: PostgresUrlAnalysisFlags;
};

const LIBPQ_FALLBACK =
  /^postgres(?:ql)?:\/\/[^/?\s]+@[^/?\s]+(\/|\?)/i;

/**
 * Full validation pipeline for diagnostics and `normalizePostgresConnectionUrl`.
 */
function analyzeConnectionUrl(raw: string): PostgresUrlAnalysis {
  const t = raw.trim();
  const raw_length = t.length;
  const trimmed_nonempty = raw_length > 0;
  const angle_template = /^<[^>]+>$/.test(t);
  const has_placeholder =
    /<DB_PASSWORD>/i.test(t) || /\[YOUR[-_ ]*PASSWORD\]/i.test(t);
  const scheme_ok = /^postgres(?:ql)?:\/\//i.test(t);
  const length_ok = t.length >= 24;
  const regex_fallback_ok = LIBPQ_FALLBACK.test(t);

  const gated =
    trimmed_nonempty && !angle_template && !has_placeholder && scheme_ok && length_ok;

  let whatwg_url_ok = false;
  let hostname_is_base = false;
  let pg_parse_ok = false;

  if (gated) {
    try {
      const u = new URL(t);
      if (u.hostname === "base") hostname_is_base = true;
      else if (u.hostname && u.hostname.length >= 3) whatwg_url_ok = true;
    } catch {
      /* leave false */
    }
    try {
      const p = parse(t);
      pg_parse_ok = Boolean(p.host?.trim() && p.user);
    } catch {
      pg_parse_ok = false;
    }
  }

  let ok = false;
  let url: string | undefined;
  if (gated) {
    try {
      const u = new URL(t);
      if (!u.hostname || u.hostname.length < 3) {
        /* reject — same as normalizePostgresConnectionUrl */
      } else if (u.hostname === "base") {
        /* reject */
      } else {
        ok = true;
        url = t;
      }
    } catch {
      try {
        const p = parse(t);
        if (p.host?.trim() && p.user) {
          ok = true;
          url = t;
        }
      } catch {
        if (regex_fallback_ok) {
          ok = true;
          url = t;
        }
      }
    }
  }

  return {
    ok,
    ...(url ? { url } : {}),
    flags: {
      raw_length,
      trimmed_nonempty,
      has_placeholder,
      angle_template,
      scheme_ok,
      length_ok,
      whatwg_url_ok,
      pg_parse_ok,
      regex_fallback_ok,
      hostname_is_base,
    },
  };
}

export function getMastraPostgresConnectionDiagnostics(): {
  env_value_present: boolean;
  env_source: PiCliDatabaseEnvSource;
  normalized_ok: boolean;
  canonical_parse_ok: boolean;
  deferred_during_next_build: boolean;
  store_init_error?: string;
  flags: PostgresUrlAnalysisFlags;
} {
  const env_source = getPiCliDatabaseEnvSource();
  const effective = getPiCliDatabaseUrl() ?? "";
  const analysis = analyzeConnectionUrl(effective);
  const normalized = analysis.ok ? analysis.url : undefined;
  let canonicalParseOk = false;
  if (normalized) {
    try {
      const p = parse(normalized);
      canonicalParseOk = Boolean(p.host?.trim() && p.user);
    } catch {
      canonicalParseOk = false;
    }
  }
  const initErr = getLastPostgresStoreInitError();
  return {
    env_value_present: Boolean(
      process.env.PI_CLI_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim(),
    ),
    env_source,
    normalized_ok: Boolean(normalized),
    canonical_parse_ok: canonicalParseOk,
    deferred_during_next_build: isNextCompilerBuild(),
    flags: analysis.flags,
    ...(initErr ? { store_init_error: initErr.slice(0, 240) } : {}),
  };
}

/**
 * Drop placeholder / malformed connection strings so we never pass junk into `pg` / @mastra/pg
 * (invalid values caused Vercel builds to log MASTRA_STORAGE_PG_INIT_FAILED with ERR_INVALID_URL).
 */
export function normalizePostgresConnectionUrl(raw: string): string | undefined {
  const a = analyzeConnectionUrl(raw.trim());
  return a.ok ? a.url : undefined;
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
    lastPostgresStoreInitError = undefined;
    try {
      const built = toCanonicalPgConnectionString(url);
      if (!built) {
        lastPostgresStoreInitError = "toCanonical_failed";
        postgresStore = null;
      } else {
        postgresStore = new PostgresStore({
          id: "mastra-pi-cli-storage",
          connectionString: built.connectionString,
          ...(built.schemaName ? { schemaName: built.schemaName } : {}),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PostgresStore_constructor_failed";
      lastPostgresStoreInitError = msg;
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
