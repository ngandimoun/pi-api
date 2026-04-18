import { mastra } from "@/mastra";
import { MASTRA_WORKFLOW_FAMILY_BY_ID } from "@/lib/workflow-family";

/**
 * Canonical Pi CLI Hokage + domain workflow ids registered on the Mastra singleton.
 * When adding a workflow in `src/mastra/index.ts`, extend this list.
 */
const EXPECTED_WORKFLOW_IDS = [
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

const EXPECTED_AGENT_IDS = ["demoAgent", "cliEnforcerAgent", "cliResonateAgent", "cliArchitectAgent"] as const;

describe("Pi CLI Hokage Mastra registry", () => {
  it("registers all expected workflows (parity with /api/cli/health)", () => {
    const listed = mastra.listWorkflows() as Record<string, unknown> | undefined;
    expect(listed).toBeTruthy();
    const keys = Object.keys(listed ?? {}).sort();
    const expected = [...EXPECTED_WORKFLOW_IDS].sort();
    expect(keys).toEqual(expected);
  });

  it("registers all expected agents", () => {
    const listed = mastra.listAgents() as Record<string, unknown> | undefined;
    expect(listed).toBeTruthy();
    const keys = Object.keys(listed ?? {}).sort();
    expect(keys).toEqual([...EXPECTED_AGENT_IDS].sort());
  });

  it.each(EXPECTED_WORKFLOW_IDS)("getWorkflow(%s) is defined", (id) => {
    expect(mastra.getWorkflow(id)).toBeDefined();
  });

  it.each(EXPECTED_AGENT_IDS)("getAgent(%s) is defined", (id) => {
    expect(mastra.getAgent(id)).toBeDefined();
  });

  it("maps every registered workflow id to a Unkey quota family", () => {
    const listed = mastra.listWorkflows() as Record<string, unknown> | undefined;
    const keys = Object.keys(listed ?? {});
    for (const id of keys) {
      expect(MASTRA_WORKFLOW_FAMILY_BY_ID[id], `missing family for workflow: ${id}`).toBeDefined();
    }
  });
});
