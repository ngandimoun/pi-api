import { Mastra } from "@mastra/core";

import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { cliResonateAgentLite } from "@/mastra/agents/cli-resonate-agent-lite";
import { cliResonateWorkflow } from "@/mastra/workflows/pi-cli/cli-resonate-workflow";

const storage = getMastraPostgresStore();

/** Mastra for `/api/cli/resonate` only (workflow + lite agent). */
export const piCliMastraResonate = new Mastra({
  ...(storage ? { storage } : {}),
  workflows: { cliResonateWorkflow },
  agents: { cliResonateAgent: cliResonateAgentLite },
});
