/**
 * Expected Mastra workflow/agent ids — must stay in sync with `src/mastra/index.ts`.
 * Used by health endpoints so they never import `@/mastra` (keeps Vercel bundles small).
 */
export const MASTRA_REGISTRY_WORKFLOW_KEYS: readonly string[] = [
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
] as const;

export const MASTRA_REGISTRY_AGENT_KEYS: readonly string[] = [
  "demoAgent",
  "cliEnforcerAgent",
  "cliResonateAgent",
  "cliArchitectAgent",
] as const;
