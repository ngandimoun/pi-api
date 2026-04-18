import { Mastra } from "@mastra/core";

import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { cliLearnWorkflow } from "@/mastra/workflows/pi-cli/cli-learn-workflow";
import { cliResonateWorkflow } from "@/mastra/workflows/pi-cli/cli-resonate-workflow";
import { cliRoutineWorkflow } from "@/mastra/workflows/pi-cli/cli-routine-workflow";
import { cliValidateWorkflow } from "@/mastra/workflows/pi-cli/cli-validate-workflow";

const storage = getMastraPostgresStore();

/**
 * Mastra for trace / validate-debug / resume — only the four user-facing CLI workflows.
 * Excludes graph-builder + adaptive + GitHub PR workflows to keep bundles smaller than `seven`.
 */
export const piCliMastraFourWorkflows = new Mastra({
  ...(storage ? { storage } : {}),
  workflows: {
    cliValidateWorkflow,
    cliRoutineWorkflow,
    cliLearnWorkflow,
    cliResonateWorkflow,
  },
  agents: {},
});
