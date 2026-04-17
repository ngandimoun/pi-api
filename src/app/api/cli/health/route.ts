import {
  getMastraPostgresConnectionDiagnostics,
  getMastraPostgresStore,
  getMastraPgVector,
} from "@/lib/mastra-storage";
import { isCliMemoryEnabled } from "@/lib/pi-cli-memory";
import { isPiCliRoutineHitlEnabled, isPiCliWorkflowModeEnabled } from "@/lib/pi-cli-workflows";
import { mastra } from "@/mastra";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSTGRES_PING_TIMEOUT_MS = 1500;

type HealthCheck = {
  default_model: { configured: boolean; source: "env" | "default" };
  postgres: {
    configured: boolean;
    reachable: boolean;
    error?: string;
    diagnostics: ReturnType<typeof getMastraPostgresConnectionDiagnostics>;
  };
  workflow_mode: { enabled: boolean };
  routine_hitl: { enabled: boolean };
  memory: { enabled: boolean; semantic_recall: boolean };
  trigger_dev: { configured: boolean };
  gemini: { configured: boolean };
  fail_closed: { enabled: boolean };
  instrumentation_ok: boolean;
};

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

function hasGeminiKey(): boolean {
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GEMINI_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim(),
  );
}

/**
 * Public readiness probe for Pi CLI Hokage Mastra wiring.
 *
 * Returns only booleans + env presence — never leaks secret values. Intended for:
 *   - `pi doctor` server-readiness block
 *   - uptime monitors / Vercel deployment checks
 *   - CI preflight before running Mastra-backed workflows
 *
 * `ok === true` means production-ready: default model set, Postgres reachable,
 * workflow mode enabled, Gemini key present.
 */
export async function GET() {
  const defaultModelConfigured = Boolean(process.env.PI_MASTRA_DEFAULT_MODEL?.trim());
  const pgDiag = getMastraPostgresConnectionDiagnostics();
  const pgPing = await pingPostgres();
  const store = getMastraPostgresStore();
  const vector = getMastraPgVector();
  const workflowEnabled = isPiCliWorkflowModeEnabled();
  const memoryEnabled = isCliMemoryEnabled();
  const semanticRecall = Boolean(vector) && hasGeminiKey();
  const triggerConfigured = Boolean(process.env.TRIGGER_SECRET_KEY?.trim());
  const geminiConfigured = hasGeminiKey();
  const failClosed = process.env.PI_CLI_FAIL_CLOSED === "true";

  const checks: HealthCheck = {
    default_model: {
      configured: defaultModelConfigured,
      source: defaultModelConfigured ? "env" : "default",
    },
    postgres: {
      configured: Boolean(store),
      reachable: pgPing.reachable,
      diagnostics: pgDiag,
      ...(pgPing.error ? { error: pgPing.error } : {}),
    },
    workflow_mode: { enabled: workflowEnabled },
    routine_hitl: { enabled: isPiCliRoutineHitlEnabled() },
    memory: { enabled: memoryEnabled, semantic_recall: semanticRecall },
    trigger_dev: { configured: triggerConfigured },
    gemini: { configured: geminiConfigured },
    fail_closed: { enabled: failClosed },
    instrumentation_ok:
      process.env.NODE_ENV !== "production" || defaultModelConfigured,
  };

  const ok =
    defaultModelConfigured &&
    pgPing.reachable &&
    workflowEnabled &&
    geminiConfigured;

  let workflows: string[] = [];
  let agents: string[] = [];
  try {
    workflows = Object.keys(mastra.listWorkflows() ?? {});
  } catch {
    /* ignore — don't fail health probe on introspection errors */
  }
  try {
    agents = Object.keys(mastra.listAgents() ?? {});
  } catch {
    /* ignore */
  }

  const response = NextResponse.json(
    {
      object: "pi_cli_health",
      ok,
      checks,
      workflows,
      agents,
      generated_at: Math.floor(Date.now() / 1000),
    },
    { status: ok ? 200 : 503 },
  );
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
