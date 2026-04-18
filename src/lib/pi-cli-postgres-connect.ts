import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ConnectionOptions } from "node:tls";
import { parse } from "pg-connection-string";

/**
 * When `PI_CLI_DATABASE_SSL_REJECT_UNAUTHORIZED=false`, pass through to `pg` so TLS connects
 * even if the chain includes a self-signed cert (corporate proxy, custom CA, misconfigured host).
 * Default is strict verification (omit `ssl` and let `pg` + system trust store decide).
 */
export function isPiCliPgTlsPeerVerificationRelaxed(): boolean {
  const v = process.env.PI_CLI_DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  return v === "false" || v === "0";
}

let relaxedTlsDeprecationLogged = false;

/**
 * PEM for a private CA (corporate proxy) or path to a PEM file.
 * If the value contains `BEGIN`, it is treated as inline PEM (use `\n` in env for newlines).
 * Otherwise it is read as a filesystem path (absolute or relative to cwd).
 */
export function loadPiCliDatabaseCaPem(): string | undefined {
  const raw = process.env.PI_CLI_DATABASE_CA_BUNDLE?.trim();
  if (!raw) return undefined;
  if (raw.includes("BEGIN CERTIFICATE") || raw.includes("BEGIN TRUSTED CERTIFICATE")) {
    return raw.replace(/\\n/g, "\n");
  }
  try {
    const p = path.isAbsolute(raw) ? raw : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
    if (!existsSync(p)) {
      console.warn("[pi-cli-postgres] PI_CLI_DATABASE_CA_BUNDLE file not found:", p);
      return undefined;
    }
    return readFileSync(p, "utf8");
  } catch (e) {
    console.warn("[pi-cli-postgres] Failed to read PI_CLI_DATABASE_CA_BUNDLE:", e);
    return undefined;
  }
}

export function getPiCliPgSslOption(): ConnectionOptions | undefined {
  const caPem = loadPiCliDatabaseCaPem();
  if (caPem) {
    return { ca: caPem, rejectUnauthorized: true };
  }
  if (isPiCliPgTlsPeerVerificationRelaxed()) {
    if (process.env.NODE_ENV === "production" && !relaxedTlsDeprecationLogged) {
      relaxedTlsDeprecationLogged = true;
      console.warn(
        "[pi-cli-postgres] WARN: PI_CLI_DATABASE_SSL_REJECT_UNAUTHORIZED=false is deprecated in production. Prefer PI_CLI_DATABASE_CA_BUNDLE or fix the server TLS trust chain.",
      );
    }
    return { rejectUnauthorized: false };
  }
  return undefined;
}

/** Hash of effective DB URL + ssl mode so we recreate pools after Vercel env edits without redeploy. */
export function pgPoolInitFingerprint(): string {
  const u = getPiCliDatabaseUrl() ?? "";
  const relaxed = isPiCliPgTlsPeerVerificationRelaxed();
  const ca = loadPiCliDatabaseCaPem();
  let mode: string;
  if (relaxed) mode = "r";
  else if (ca) mode = `c:${createHash("sha256").update(ca).digest("hex").slice(0, 16)}`;
  else mode = "s";
  const h = createHash("sha256").update(u).digest("hex").slice(0, 32);
  return `${mode}:${h}`;
}

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
export function isPiCliPostgresDeferredDuringNextBuild(): boolean {
  if (process.env.FORCE_MASTRA_STORAGE_IN_BUILD === "true") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return true;
  if (process.env.NEXT_PHASE === "phase-development-build") return true;
  // Do not use `npm_lifecycle_event === "build"` here: some runtimes inherit it and would
  // incorrectly skip Postgres for every request (health would show not_configured).
  return false;
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

const LIBPQ_FALLBACK = /^postgres(?:ql)?:\/\/[^/?\s]+@[^/?\s]+(\/|\?)/i;

/**
 * Full validation pipeline for diagnostics and `normalizePostgresConnectionUrl`.
 */
export function analyzePostgresConnectionUrl(raw: string): PostgresUrlAnalysis {
  const t = raw.trim();
  const raw_length = t.length;
  const trimmed_nonempty = raw_length > 0;
  const angle_template = /^<[^>]+>$/.test(t);
  const has_placeholder = /<DB_PASSWORD>/i.test(t) || /\[YOUR[-_ ]*PASSWORD\]/i.test(t);
  const scheme_ok = /^postgres(?:ql)?:\/\//i.test(t);
  const length_ok = t.length >= 24;
  const regex_fallback_ok = LIBPQ_FALLBACK.test(t);

  const gated = trimmed_nonempty && !angle_template && !has_placeholder && scheme_ok && length_ok;

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
        // Do not accept regex_fallback_ok alone: `toCanonicalPgConnectionString` always uses
        // `parse()`; a string that matches the heuristic but throws in parse() would yield
        // normalized_ok true + store_init_error "toCanonical_failed" (misleading).
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

/**
 * Drop placeholder / malformed connection strings so we never pass junk into `pg` / @mastra/pg
 * (invalid values caused Vercel builds to log MASTRA_STORAGE_PG_INIT_FAILED with ERR_INVALID_URL).
 */
export function normalizePostgresConnectionUrl(raw: string): string | undefined {
  const a = analyzePostgresConnectionUrl(raw.trim());
  return a.ok ? a.url : undefined;
}

/**
 * Parse the URI with `pg-connection-string` (same as `node-postgres`), then build a **canonical**
 * connection string with an encoded user/password segment. This avoids `Invalid URL` from
 * `new URL(str, "postgres://base")` when passwords contain reserved characters or when `?schema=…`
 * is present (we pass `schema` to Mastra as `schemaName` and omit it from the string passed to `pg`).
 */
export function toCanonicalPgConnectionString(
  normalizedUrl: string,
): { connectionString: string; schemaName?: string } | null {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(normalizedUrl);
  } catch (e) {
    console.warn("[pi-cli-postgres] pg-connection-string parse failed:", e);
    return null;
  }

  const rawSchema = (parsed as { schema?: unknown }).schema;
  const schemaName =
    typeof rawSchema === "string" && rawSchema.trim().length > 0 ? rawSchema.trim() : undefined;

  const host = parsed.host?.trim();
  if (!host || !parsed.user) {
    console.warn("[pi-cli-postgres] parsed connection missing host or user");
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
  const relaxedTls = isPiCliPgTlsPeerVerificationRelaxed();
  if (
    (host.endsWith(".pooler.supabase.com") || host.includes("pooler.supabase.com") || host.endsWith(".supabase.co")) &&
    !qs.has("sslmode") &&
    !relaxedTls
  ) {
    qs.set("sslmode", "require");
  }
  // `pg` merges `parse(connectionString)` over Pool config; `sslmode=require` becomes `ssl: {}`
  // and wipes `ssl: { rejectUnauthorized: false }`. Omit sslmode from the URI when using TLS relax.
  if (relaxedTls) {
    qs.delete("sslmode");
  }

  const qstr = qs.toString();
  const connectionString = `postgresql://${user}${pass}@${host}:${port}/${database}${qstr ? `?${qstr}` : ""}`;
  return { connectionString, ...(schemaName ? { schemaName } : {}) };
}
