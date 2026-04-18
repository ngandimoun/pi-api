import { runPiHealthProbe, type PiHealthSnapshot } from "@/lib/pi-health-core";
import { MASTRA_REGISTRY_AGENT_KEYS, MASTRA_REGISTRY_WORKFLOW_KEYS } from "@/lib/pi-mastra-registry-keys";

/**
 * Lightweight Pi CLI readiness snapshot — no `@/mastra` import.
 */
export async function buildPiCliHealthSnapshot(): Promise<PiHealthSnapshot> {
  const { checks, ok } = await runPiHealthProbe({ strict: false });
  return {
    object: "pi_cli_health",
    ok,
    checks,
    workflows: [...MASTRA_REGISTRY_WORKFLOW_KEYS],
    agents: [...MASTRA_REGISTRY_AGENT_KEYS],
    generated_at: Math.floor(Date.now() / 1000),
  };
}
