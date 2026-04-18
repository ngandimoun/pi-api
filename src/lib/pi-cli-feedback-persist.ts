import { randomUUID } from "node:crypto";

import {
  getPiCliDatabaseUrl,
  getPiCliPgSslOption,
  isPiCliPostgresDeferredDuringNextBuild,
  normalizePostgresConnectionUrl,
  toCanonicalPgConnectionString,
} from "./pi-cli-postgres-connect";

function quoteSqlIdent(ident: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error("invalid_sql_identifier");
  }
  return `"${ident.replace(/"/g, '""')}"`;
}

/**
 * Same gate as `isCliMemoryEnabled()` without importing `@mastra/memory` / Mastra embedders
 * (keeps `/api/cli/prompt/feedback` under Vercel’s serverless bundle size cap).
 */
export function isPromptFeedbackPersistenceEnabled(): boolean {
  if (process.env.PI_CLI_ENABLE_MEMORY === "false") return false;
  if (isPiCliPostgresDeferredDuringNextBuild()) return false;
  return Boolean(getPiCliDatabaseUrl());
}

/**
 * Inserts a thread row (if missing) + one user message compatible with `@mastra/pg` memory tables.
 * Requires `PI_CLI_DATABASE_URL` with `?schema=mastra` (or explicit `schemaName`) matching deployed DDL.
 */
export async function persistPromptFeedbackToMastraMemoryTables(input: {
  resourceId: string;
  threadId: string;
  intentSlug: string;
  intent: string;
  feedbackLabel: "useful" | "not_useful";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = getPiCliDatabaseUrl();
  const normalized = raw ? normalizePostgresConnectionUrl(raw) : undefined;
  if (!normalized) return { ok: false, error: "database_not_configured" };
  if (isPiCliPostgresDeferredDuringNextBuild()) return { ok: false, error: "deferred_during_build" };

  const built = toCanonicalPgConnectionString(normalized);
  if (!built) return { ok: false, error: "canonical_parse_failed" };

  const ssl = getPiCliPgSslOption();
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: built.connectionString,
    ...(ssl ? { ssl } : {}),
  });

  const schemaName = built.schemaName ?? "mastra";
  const qSch = quoteSqlIdent(schemaName);
  const threadsTable = `${qSch}.${quoteSqlIdent("mastra_threads")}`;
  const messagesTable = `${qSch}.${quoteSqlIdent("mastra_messages")}`;

  const title = "Pi prompt feedback";
  const content = `[prompt-feedback:${input.feedbackLabel}] slug=${input.intentSlug} intent=${JSON.stringify(input.intent)}`;

  try {
    await client.connect();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 500) : "connect_failed",
    };
  }

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO ${threadsTable} (id, "resourceId", title, metadata, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NULL, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [input.threadId, input.resourceId, title],
    );
    await client.query(
      `INSERT INTO ${messagesTable} (id, thread_id, content, role, type, "createdAt", "resourceId")
       VALUES ($1, $2, $3, $4, $5, now(), $6)`,
      [randomUUID(), input.threadId, content, "user", "text", input.resourceId],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 500) : "persist_failed",
    };
  } finally {
    await client.end().catch(() => {});
  }
}
