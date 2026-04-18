import { Mastra } from "@mastra/core";

import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { cliAdaptiveEngineWorkflow } from "@/mastra/workflows/pi-cli/cli-adaptive-engine-workflow";
import { cliGithubPrCheckWorkflow } from "@/mastra/workflows/pi-cli/cli-github-pr-check-workflow";
import { cliGraphBuilderWorkflow } from "@/mastra/workflows/pi-cli/cli-graph-builder-workflow";
import { cliLearnWorkflow } from "@/mastra/workflows/pi-cli/cli-learn-workflow";
import { cliResonateWorkflow } from "@/mastra/workflows/pi-cli/cli-resonate-workflow";
import { cliRoutineWorkflow } from "@/mastra/workflows/pi-cli/cli-routine-workflow";
import { cliValidateWorkflow } from "@/mastra/workflows/pi-cli/cli-validate-workflow";

const storage = getMastraPostgresStore();

/** Mastra for workflow poll + status (all registered Pi CLI workflows). */
export const piCliMastraSevenWorkflows = new Mastra({
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
  agents: {},
});
