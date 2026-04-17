import { Mastra } from "@mastra/core";

import { getMastraPostgresStore } from "@/lib/mastra-storage";

import { cliArchitectAgent } from "./agents/cli-architect-agent";
import { cliEnforcerAgent } from "./agents/cli-enforcer-agent";
import { cliResonateAgent } from "./agents/cli-resonate-agent";
import { demoAgent } from "./agents/demo-agent";
import { campaignAdsWorkflow } from "./workflows/campaign-ads/workflow";
import { campaignLocalizeWorkflow } from "./workflows/campaign-localize/workflow";
import { adherenceWorkflow } from "./workflows/adherence/workflow";
import { cognitiveWellnessWorkflow } from "./workflows/cognitive-wellness/workflow";
import { decisionSupportWorkflow } from "./workflows/decision-support/workflow";
import { healthTriageWorkflow } from "./workflows/health-triage/workflow";
import { medicationCheckWorkflow } from "./workflows/medication-check/workflow";
import { neuroDecodeWorkflow } from "./workflows/neuro-decode/workflow";
import { notesStructureWorkflow } from "./workflows/notes-structure/workflow";
import { patientRiskWorkflow } from "./workflows/patient-risk/workflow";
import { researchAssistWorkflow } from "./workflows/research-assist/workflow";
import { scanAnalysisWorkflow } from "./workflows/scan-analysis/workflow";
import { surveillanceStreamWorkflow } from "./workflows/surveillance-stream/workflow";
import { robotRunWorkflow } from "./workflows/robot-run/workflow";
import { uppercaseWorkflow } from "./workflows/uppercase-workflow";
import { cliAdaptiveEngineWorkflow } from "./workflows/pi-cli/cli-adaptive-engine-workflow";
import { cliGithubPrCheckWorkflow } from "./workflows/pi-cli/cli-github-pr-check-workflow";
import { cliGraphBuilderWorkflow } from "./workflows/pi-cli/cli-graph-builder-workflow";
import { cliLearnWorkflow } from "./workflows/pi-cli/cli-learn-workflow";
import { cliResonateWorkflow } from "./workflows/pi-cli/cli-resonate-workflow";
import { cliRoutineWorkflow } from "./workflows/pi-cli/cli-routine-workflow";
import { cliValidateWorkflow } from "./workflows/pi-cli/cli-validate-workflow";

const mastraStorage = getMastraPostgresStore();

export const mastra = new Mastra({
  ...(mastraStorage ? { storage: mastraStorage } : {}),
  workflows: {
    uppercaseWorkflow,
    campaignAdsWorkflow,
    campaignLocalizeWorkflow,
    healthTriageWorkflow,
    neuroDecodeWorkflow,
    cognitiveWellnessWorkflow,
    patientRiskWorkflow,
    adherenceWorkflow,
    notesStructureWorkflow,
    decisionSupportWorkflow,
    medicationCheckWorkflow,
    scanAnalysisWorkflow,
    researchAssistWorkflow,
    surveillanceStreamWorkflow,
    robotRunWorkflow,
    cliValidateWorkflow,
    cliRoutineWorkflow,
    cliLearnWorkflow,
    cliGraphBuilderWorkflow,
    cliAdaptiveEngineWorkflow,
    cliGithubPrCheckWorkflow,
    cliResonateWorkflow,
  },
  agents: {
    demoAgent,
    cliEnforcerAgent,
    cliResonateAgent,
    cliArchitectAgent,
  },
});

