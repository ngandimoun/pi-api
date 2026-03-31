import { Mastra } from "@mastra/core";
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

export const mastra = new Mastra({
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
  },
  agents: {
    demoAgent,
  },
});

