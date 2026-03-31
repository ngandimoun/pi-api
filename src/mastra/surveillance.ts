import { Mastra } from "@mastra/core";

import { surveillanceStreamWorkflow } from "./workflows/surveillance-stream/workflow";

/**
 * Minimal Mastra instance for surveillance-only Trigger.dev builds.
 * Avoids importing/registering unrelated workflows and agents.
 */
export const mastraSurveillance = new Mastra({
  workflows: {
    surveillanceStreamWorkflow,
  },
  agents: {},
});

