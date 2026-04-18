import {
  getMastraPostgresConnectionDiagnostics,
  getMastraPostgresStore,
  getMastraPgVector,
} from "@/lib/mastra-storage";
import { isPiCliRoutineHitlEnabled, isPiCliWorkflowModeEnabled } from "@/lib/pi-cli-workflows";
import { getUnkeyClient } from "@/lib/unkey";

const POSTGRES_PING_TIMEOUT_MS = 1500;

export type PiHealthChecks = {
  default_model: { configured: boolean; source: "env" | "default" };
  postgres: {
    configured: boolean;
    reachable: boolean;
    error?: string;
    diagnostics: ReturnType<typeof getMastraPostgresConnectionDiagnostics>;
    memory_table?: {
      message_count: number | null;
      oldest_message_age_seconds: number | null;
      error?: string;
    };
  };
  workflow_mode: { enabled: boolean };
  routine_hitl: { enabled: boolean };
  memory: { enabled: boolean; semantic_recall: boolean };
  trigger_dev: { configured: boolean };
  stripe: { webhook_secret_configured: boolean; secret_key_configured: boolean };
  unkey: { root_key_configured: boolean; reachable: boolean; error?: string };
  gemini: { configured: boolean };
  fail_closed: { enabled: boolean };
  instrumentation_ok: boolean;
};

export type PiHealthSnapshot = {
  object: "pi_health" | "pi_cli_health";
  ok: boolean;
  checks: PiHealthChecks;
  workflows: string[];
  agents: string[];
  generated_at: number;
};

/** Same logic as `isCliMemoryEnabled` in `pi-cli-memory.ts` — inlined to avoid `@mastra/memory` in this bundle. */
function isCliMemoryEnabledForHealth(): boolean {
  if (process.env.PI_CLI_ENABLE_MEMORY === "false") return false;
  return Boolean(getMastraPostgresStore());
}

function hasGeminiKey(): boolean {
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GEMINI_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim(),
  );
}

async function pingPostgres(): Promise<{ reachable: boolean; error?: string }> {
  const store = getMastraPostgresStore();
  if (!store) return { reachable: false, error: "not_configured" };
  try {
    const result = await Promise.race([
      store.db.one<{ ok: number }>("select 1 as ok"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), POSTGRES_PING_TIMEOUT_MS),
      ),
    ]);
    return { reachable: Number(result?.ok) === 1 };
  } catch (e) {
    return { reachable: false, error: e instanceof Error ? e.message : "ping_failed" };
  }
}

async function loadMemoryTableStats(): Promise<{
  message_count: number | null;
  oldest_message_age_seconds: number | null;
  error?: string;
}> {
  const store = getMastraPostgresStore();
  if (!store) {
    return { message_count: null, oldest_message_age_seconds: null, error: "not_configured" };
  }
  try {
    const row = await Promise.race([
      store.db.one<{
        message_count: string | number | null;
        oldest_seconds: string | number | null;
      }>(
        `select count(*)::text as message_count,
                extract(epoch from (now() - min("createdAt")))::text as oldest_seconds
           from mastra.mastra_messages`,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), POSTGRES_PING_TIMEOUT_MS),
      ),
    ]);
    const message_count =
      row?.message_count != null ? Number.parseInt(String(row.message_count), 10) : null;
    const oldest_message_age_seconds =
      row?.oldest_seconds != null && String(row.oldest_seconds) !== ""
        ? Number.parseFloat(String(row.oldest_seconds))
        : null;
    return {
      message_count: Number.isFinite(message_count ?? NaN) ? (message_count as number) : null,
      oldest_message_age_seconds: Number.isFinite(oldest_message_age_seconds ?? NaN)
        ? (oldest_message_age_seconds as number)
        : null,
    };
  } catch (e) {
    return {
      message_count: null,
      oldest_message_age_seconds: null,
      error: e instanceof Error ? e.message.slice(0, 200) : "memory_stats_failed",
    };
  }
}

async function pingUnkeyRoot(): Promise<{ reachable: boolean; error?: string }> {
  const rk = process.env.UNKEY_ROOT_KEY?.trim();
  if (!rk) return { reachable: false, error: "not_configured" };
  try {
    const client = getUnkeyClient();
    await client.keys.whoami({ key: rk });
    return { reachable: true };
  } catch (e) {
    return { reachable: false, error: e instanceof Error ? e.message.slice(0, 200) : "unkey_whoami_failed" };
  }
}

/**
 * Postgres / env / Unkey checks only — no `@/mastra` import (keeps `/api/cli/health` under Vercel size limits).
 */
export async function runPiHealthProbe(opts: { strict: boolean }): Promise<{
  checks: PiHealthChecks;
  ok: boolean;
}> {
  const { strict } = opts;
  const defaultModelConfigured = Boolean(process.env.PI_MASTRA_DEFAULT_MODEL?.trim());
  const pgPing = await pingPostgres();
  const store = getMastraPostgresStore();
  const pgDiag = getMastraPostgresConnectionDiagnostics();
  const vector = getMastraPgVector();
  const workflowEnabled = isPiCliWorkflowModeEnabled();
  const memoryEnabled = isCliMemoryEnabledForHealth();
  const semanticRecall = Boolean(vector) && hasGeminiKey();
  const triggerConfigured = Boolean(process.env.TRIGGER_SECRET_KEY?.trim());
  const geminiConfigured = hasGeminiKey();
  const failClosed = process.env.PI_CLI_FAIL_CLOSED === "true";
  const stripeWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const stripeSecret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const unkeyRoot = Boolean(process.env.UNKEY_ROOT_KEY?.trim());
  const unkeyPing = await pingUnkeyRoot();

  const memStats = await loadMemoryTableStats();

  const checks: PiHealthChecks = {
    default_model: {
      configured: defaultModelConfigured,
      source: defaultModelConfigured ? "env" : "default",
    },
    postgres: {
      configured: Boolean(store),
      reachable: pgPing.reachable,
      diagnostics: pgDiag,
      memory_table: {
        message_count: memStats.message_count,
        oldest_message_age_seconds: memStats.oldest_message_age_seconds,
        ...(memStats.error ? { error: memStats.error } : {}),
      },
      ...(pgPing.error ? { error: pgPing.error } : {}),
    },
    workflow_mode: { enabled: workflowEnabled },
    routine_hitl: { enabled: isPiCliRoutineHitlEnabled() },
    memory: { enabled: memoryEnabled, semantic_recall: semanticRecall },
    trigger_dev: { configured: triggerConfigured },
    stripe: { webhook_secret_configured: stripeWebhook, secret_key_configured: stripeSecret },
    unkey: {
      root_key_configured: unkeyRoot,
      reachable: unkeyPing.reachable,
      ...(unkeyPing.error ? { error: unkeyPing.error } : {}),
    },
    gemini: { configured: geminiConfigured },
    fail_closed: { enabled: failClosed },
    instrumentation_ok: process.env.NODE_ENV !== "production" || defaultModelConfigured,
  };

  const baseOk =
    defaultModelConfigured && pgPing.reachable && workflowEnabled && geminiConfigured;
  const ok = strict
    ? baseOk && unkeyRoot && unkeyPing.reachable && stripeWebhook
    : baseOk;

  return { checks, ok };
}
