import { PgVector, PostgresStore } from "@mastra/pg";
import { parse } from "pg-connection-string";

import {
  analyzePostgresConnectionUrl,
  getPiCliDatabaseEnvSource,
  getPiCliDatabaseUrl,
  isPiCliPgTlsPeerVerificationRelaxed,
  isPiCliPostgresDeferredDuringNextBuild,
  loadPiCliDatabaseCaPem,
  normalizePostgresConnectionUrl,
  pgPoolInitFingerprint,
  toCanonicalPgConnectionString,
  getPiCliPgSslOption,
  type PiCliDatabaseEnvSource,
  type PostgresUrlAnalysis,
  type PostgresUrlAnalysisFlags,
  sanitizePastedDatabaseUrl,
} from "./pi-cli-postgres-connect";

export type { PiCliDatabaseEnvSource, PostgresUrlAnalysis, PostgresUrlAnalysisFlags };
export {
  sanitizePastedDatabaseUrl,
  getPiCliDatabaseEnvSource,
  getPiCliDatabaseUrl,
  normalizePostgresConnectionUrl,
} from "./pi-cli-postgres-connect";

let postgresStore: PostgresStore | null | undefined;
let pgVector: PgVector | null | undefined;
/** Fingerprint of URL + TLS relax flag used when the pool was created (warm Lambdas must rebuild after env change). */
let mastraPgStoreInitFingerprint: string | undefined;
let mastraPgVectorInitFingerprint: string | undefined;

/** Set when PostgresStore init fails; safe to surface in /api/cli/health (no secrets). */
let lastPostgresStoreInitError: string | undefined;

export function getLastPostgresStoreInitError(): string | undefined {
  return lastPostgresStoreInitError;
}

export function getMastraPostgresConnectionDiagnostics(): {
  env_value_present: boolean;
  env_source: PiCliDatabaseEnvSource;
  normalized_ok: boolean;
  canonical_parse_ok: boolean;
  deferred_during_next_build: boolean;
  ssl_peer_verification_relaxed: boolean;
  ssl_ca_bundle_configured: boolean;
  store_init_error?: string;
  flags: PostgresUrlAnalysisFlags;
} {
  const env_source = getPiCliDatabaseEnvSource();
  const effective = getPiCliDatabaseUrl() ?? "";
  const analysis = analyzePostgresConnectionUrl(effective);
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
    deferred_during_next_build: isPiCliPostgresDeferredDuringNextBuild(),
    ssl_peer_verification_relaxed: isPiCliPgTlsPeerVerificationRelaxed(),
    ssl_ca_bundle_configured: Boolean(loadPiCliDatabaseCaPem()),
    flags: analysis.flags,
    ...(initErr ? { store_init_error: initErr.slice(0, 240) } : {}),
  };
}

export function getMastraPostgresStore(): PostgresStore | null {
  const raw = getPiCliDatabaseUrl();
  const url = raw ? normalizePostgresConnectionUrl(raw) : undefined;
  if (!url) return null;
  if (isPiCliPostgresDeferredDuringNextBuild()) return null;

  const fp = pgPoolInitFingerprint();
  if (
    postgresStore !== undefined &&
    mastraPgStoreInitFingerprint !== undefined &&
    mastraPgStoreInitFingerprint !== fp
  ) {
    const prev = postgresStore;
    postgresStore = undefined;
    mastraPgStoreInitFingerprint = undefined;
    if (prev) void prev.close().catch(() => {});
  }

  if (postgresStore === undefined) {
    lastPostgresStoreInitError = undefined;
    try {
      const built = toCanonicalPgConnectionString(url);
      if (!built) {
        lastPostgresStoreInitError = "toCanonical_failed";
        postgresStore = null;
        mastraPgStoreInitFingerprint = undefined;
      } else {
        const ssl = getPiCliPgSslOption();
        postgresStore = new PostgresStore({
          id: "mastra-pi-cli-storage",
          connectionString: built.connectionString,
          ...(built.schemaName ? { schemaName: built.schemaName } : {}),
          ...(ssl ? { ssl } : {}),
        });
        mastraPgStoreInitFingerprint = fp;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PostgresStore_constructor_failed";
      lastPostgresStoreInitError = msg;
      console.warn("[mastra-storage] PostgresStore constructor failed:", e);
      postgresStore = null;
      mastraPgStoreInitFingerprint = undefined;
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
  if (isPiCliPostgresDeferredDuringNextBuild()) return null;

  const fp = pgPoolInitFingerprint();
  if (pgVector !== undefined && mastraPgVectorInitFingerprint !== undefined && mastraPgVectorInitFingerprint !== fp) {
    const prev = pgVector;
    pgVector = undefined;
    mastraPgVectorInitFingerprint = undefined;
    const pool = (prev as { pool?: { end: () => Promise<void> } })?.pool;
    if (pool) void pool.end().catch(() => {});
  }

  if (pgVector === undefined) {
    try {
      const built = toCanonicalPgConnectionString(url);
      if (!built) {
        pgVector = null;
        mastraPgVectorInitFingerprint = undefined;
      } else {
        const ssl = getPiCliPgSslOption();
        pgVector = new PgVector({
          id: "mastra-pi-cli-vector",
          connectionString: built.connectionString,
          ...(built.schemaName ? { schemaName: built.schemaName } : {}),
          ...(ssl ? { ssl } : {}),
        });
        mastraPgVectorInitFingerprint = fp;
      }
    } catch (e) {
      console.warn("[mastra-storage] PgVector constructor failed:", e);
      pgVector = null;
      mastraPgVectorInitFingerprint = undefined;
    }
  }
  return pgVector ?? null;
}
