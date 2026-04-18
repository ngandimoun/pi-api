import { runPiHealthProbe, type PiHealthSnapshot } from "@/lib/pi-health-core";

/**
 * Full readiness including live Mastra workflow/agent registry (imports `@/mastra`).
 * Use only from routes that can afford the bundle size (e.g. `GET /api/health`), not `/api/cli/health`.
 */
export async function buildPiHealthSnapshot(opts: {
  object: "pi_health" | "pi_cli_health";
}): Promise<PiHealthSnapshot> {
  const strict = opts.object === "pi_health";
  const { checks, ok } = await runPiHealthProbe({ strict });

  let workflows: string[] = [];
  let agents: string[] = [];
  try {
    const { mastra } = await import("@/mastra");
    workflows = Object.keys(mastra.listWorkflows() ?? {});
    agents = Object.keys(mastra.listAgents() ?? {});
  } catch {
    /* ignore */
  }

  return {
    object: opts.object,
    ok,
    checks,
    workflows,
    agents,
    generated_at: Math.floor(Date.now() / 1000),
  };
}
