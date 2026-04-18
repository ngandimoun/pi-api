import { runPiHealthProbe, type PiHealthSnapshot } from "@/lib/pi-health-core";
import { MASTRA_REGISTRY_AGENT_KEYS, MASTRA_REGISTRY_WORKFLOW_KEYS } from "@/lib/pi-mastra-registry-keys";

/**
 * Full readiness for `GET /api/health` without importing `@/mastra` (avoids bundling the full registry on Vercel).
 * Workflow/agent keys mirror `src/mastra/index.ts` via {@link MASTRA_REGISTRY_WORKFLOW_KEYS}.
 */
export async function buildPiHealthSnapshot(opts: {
  object: "pi_health" | "pi_cli_health";
}): Promise<PiHealthSnapshot> {
  const strict = opts.object === "pi_health";
  const { checks, ok } = await runPiHealthProbe({ strict });

  return {
    object: opts.object,
    ok,
    checks,
    workflows: [...MASTRA_REGISTRY_WORKFLOW_KEYS],
    agents: [...MASTRA_REGISTRY_AGENT_KEYS],
    generated_at: Math.floor(Date.now() / 1000),
  };
}
