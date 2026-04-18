import { Mastra } from "@mastra/core";

import { getMastraPostgresStore } from "@/lib/mastra-storage";

import { cliArchitectAgent } from "@/mastra/agents/cli-architect-agent";
import { cliEnforcerAgent } from "@/mastra/agents/cli-enforcer-agent";
import { cliResonateAgent } from "@/mastra/agents/cli-resonate-agent";
import { cliAdaptiveEngineWorkflow } from "@/mastra/workflows/pi-cli/cli-adaptive-engine-workflow";
import { cliGithubPrCheckWorkflow } from "@/mastra/workflows/pi-cli/cli-github-pr-check-workflow";
import { cliGraphBuilderWorkflow } from "@/mastra/workflows/pi-cli/cli-graph-builder-workflow";
import { cliLearnWorkflow } from "@/mastra/workflows/pi-cli/cli-learn-workflow";
import { cliResonateWorkflow } from "@/mastra/workflows/pi-cli/cli-resonate-workflow";
import { cliRoutineWorkflow } from "@/mastra/workflows/pi-cli/cli-routine-workflow";
import { cliValidateWorkflow } from "@/mastra/workflows/pi-cli/cli-validate-workflow";

const storage = getMastraPostgresStore();

export const piCliMastra = new Mastra({
  ...(storage ? { storage } : {}),
  workflows: {
    cliValidateWorkflow,
    cliRoutineWorkflow,
    cliLearnWorkflow,
    cliGraphBuilderWorkflow,
    cliAdaptiveEngineWorkflow,
    cliGithubPrCheckWorkflow,
    cliResonateWorkflow,
  },
  agents: {
    cliEnforcerAgent,
    cliResonateAgent,
    cliArchitectAgent,
  },
});
