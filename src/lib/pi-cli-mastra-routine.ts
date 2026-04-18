import { Mastra } from "@mastra/core";

import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { cliRoutineWorkflow } from "@/mastra/workflows/pi-cli/cli-routine-workflow";

const storage = getMastraPostgresStore();

/** Mastra for `/api/cli/routine/generate` only. */
export const piCliMastraRoutine = new Mastra({
  ...(storage ? { storage } : {}),
  workflows: { cliRoutineWorkflow },
  agents: {},
});
