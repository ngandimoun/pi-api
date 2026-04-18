import { runPiHealthProbe, type PiHealthSnapshot } from "@/lib/pi-health-core";

/**
 * Expected Mastra workflow keys — must stay in sync with `src/mastra/index.ts` `workflows` map.
 * Listed here so `GET /api/cli/health` never imports `@/mastra` (avoids ~750MB+ serverless bundles on Vercel).
 */
const MASTRA_REGISTRY_WORKFLOW_KEYS: readonly string[] = [
  "uppercaseWorkflow",
  "campaignAdsWorkflow",
  "campaignLocalizeWorkflow",
  "healthTriageWorkflow",
  "neuroDecodeWorkflow",
  "cognitiveWellnessWorkflow",
  "patientRiskWorkflow",
  "adherenceWorkflow",
  "notesStructureWorkflow",
  "decisionSupportWorkflow",
  "medicationCheckWorkflow",
  "scanAnalysisWorkflow",
  "researchAssistWorkflow",
  "surveillanceStreamWorkflow",
  "robotRunWorkflow",
  "cliValidateWorkflow",
  "cliRoutineWorkflow",
  "cliLearnWorkflow",
  "cliGraphBuilderWorkflow",
  "cliAdaptiveEngineWorkflow",
  "cliGithubPrCheckWorkflow",
  "cliResonateWorkflow",
];

/** Expected Mastra agent keys — sync with `src/mastra/index.ts` `agents` map. */
const MASTRA_REGISTRY_AGENT_KEYS: readonly string[] = [
  "demoAgent",
  "cliEnforcerAgent",
  "cliResonateAgent",
  "cliArchitectAgent",
];

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
