import { Mastra } from "@mastra/core";

import { robotRunWorkflow } from "./workflows/robot-run/workflow";

/**
 * Minimal Mastra instance for robotics-only Trigger.dev builds.
 * Avoids importing/registering unrelated workflows and agents.
 */
export const mastraRobotics = new Mastra({
  workflows: {
    robotRunWorkflow,
  },
  agents: {},
});

