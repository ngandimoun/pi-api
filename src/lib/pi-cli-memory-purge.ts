import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { buildCliResourceId } from "@/lib/pi-cli-thread";

function isSafeSqlIdentifier(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

/**
 * GDPR / support: delete Mastra memory rows for one organization’s CLI resource id.
 * Uses the same resource id convention as `buildCliResourceId` (`pi_cli_org_*`).
 */
export async function purgeOrgMemory(organizationId: string): Promise<{
  ok: boolean;
  error?: string;
  threads_deleted?: number;
}> {
  const store = getMastraPostgresStore();
  if (!store) {
    return { ok: false, error: "postgres_not_configured" };
  }

  const resourceId = buildCliResourceId(organizationId);
  const threadTable = "mastra.mastra_threads";
  const messageTable = "mastra.mastra_messages";

  try {
    const threads = await store.db.manyOrNone<{ id: string }>(
      `SELECT id FROM ${threadTable} WHERE "resourceId" = $1`,
      [resourceId],
    );
    const ids = threads.map((t) => t.id);
    if (ids.length === 0) {
      return { ok: true, threads_deleted: 0 };
    }

    const vectorTables = await store.db.manyOrNone<{ tablename: string }>(
      `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'mastra'
        AND (tablename = 'memory_messages' OR tablename LIKE 'memory_messages_%')
    `,
    );

    for (const threadId of ids) {
      await store.db.none(`DELETE FROM ${messageTable} WHERE thread_id = $1`, [threadId]);
      for (const row of vectorTables) {
        if (!isSafeSqlIdentifier(row.tablename)) continue;
        await store.db.none(`DELETE FROM mastra.${row.tablename} WHERE metadata->>'thread_id' = $1`, [threadId]);
      }
      try {
        await store.db.none(`DELETE FROM mastra.mastra_observational_memory WHERE "threadId" = $1`, [threadId]);
      } catch {
        /* table may not exist in older deployments */
      }
      await store.db.none(`DELETE FROM ${threadTable} WHERE id = $1`, [threadId]);
    }

    return { ok: true, threads_deleted: ids.length };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 240) : "purge_failed",
    };
  }
}
