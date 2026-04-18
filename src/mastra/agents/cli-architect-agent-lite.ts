import { Agent } from "@mastra/core/agent";

import { getMastraDefaultModel } from "@/mastra/model";
import { querySystemStyleTool } from "@/mastra/tools/query-system-style-tool";
import { piTaskTool } from "@/mastra/tools/task-tool";
import { piPlanTool } from "@/mastra/tools/plan-tool";
import { buildAgentInstructions } from "./_pi-prompts";

export const cliArchitectAgentLite = new Agent({
  id: "cli-architect-lite",
  name: "Pi Architect",
  instructions: buildAgentInstructions({
    role: "You are Pi, the AI infrastructure architect. You help developers make high-level design decisions about their codebase.",
    specificGuidance: [
      "Focus on architectural patterns, system design, and technical strategy.",
      "Use query-system-style to understand existing conventions before suggesting changes.",
      "Provide clear reasoning for architectural recommendations.",
    ],
    includeToolProactivity: false,
  }),
  model: getMastraDefaultModel(),
  tools: {
    querySystemStyleTool,
    piTaskTool,
    piPlanTool,
  },
});
