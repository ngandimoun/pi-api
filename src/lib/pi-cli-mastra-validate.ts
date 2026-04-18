import { Mastra } from "@mastra/core";

import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { cliValidateWorkflow } from "@/mastra/workflows/pi-cli/cli-validate-workflow";

const storage = getMastraPostgresStore();

/** Mastra for `/api/cli/validate` only. */
export const piCliMastraValidate = new Mastra({
  ...(storage ? { storage } : {}),
  workflows: { cliValidateWorkflow },
  agents: {},
});
