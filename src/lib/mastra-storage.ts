import { PgVector, PostgresStore } from "@mastra/pg";

let postgresStore: PostgresStore | null | undefined;
let pgVector: PgVector | null | undefined;

/**
 * Postgres connection for Mastra storage + workflow snapshots (time travel / resume).
 * Prefer PI_CLI_DATABASE_URL; fall back to DATABASE_URL for shared Supabase Postgres.
 */
export function getPiCliDatabaseUrl(): string | undefined {
  const direct = process.env.PI_CLI_DATABASE_URL?.trim();
  if (direct) return direct;
  return process.env.DATABASE_URL?.trim() || undefined;
}

export function getMastraPostgresStore(): PostgresStore | null {
  const url = getPiCliDatabaseUrl();
  if (!url) return null;
  if (postgresStore === undefined) {
    postgresStore = new PostgresStore({
      id: "mastra-pi-cli-storage",
      connectionString: url,
    });
  }
  return postgresStore;
}

/**
 * pgvector store for Mastra Memory semantic recall (optional; requires embedder in Memory).
 */
export function getMastraPgVector(): PgVector | null {
  const url = getPiCliDatabaseUrl();
  if (!url) return null;
  if (pgVector === undefined) {
    pgVector = new PgVector({
      id: "mastra-pi-cli-vector",
      connectionString: url,
    });
  }
  return pgVector;
}
