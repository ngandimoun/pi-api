import { Mastra } from "@mastra/core";

import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { cliLearnWorkflow } from "@/mastra/workflows/pi-cli/cli-learn-workflow";

const storage = getMastraPostgresStore();

/** Mastra for `/api/cli/learn` only — avoids bundling other Pi CLI workflows into this function. */
export const piCliMastraLearn = new Mastra({
  ...(storage ? { storage } : {}),
  workflows: { cliLearnWorkflow },
  agents: {},
});
