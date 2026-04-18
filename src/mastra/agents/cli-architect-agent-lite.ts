import { Agent } from "@mastra/core/agent";

import { getMastraDefaultModel } from "@/mastra/model";
import { queryDependencyGraphTool } from "@/mastra/tools/query-dependency-graph-tool";
import { querySystemStyleTool } from "@/mastra/tools/query-system-style-tool";
import { piTaskTool } from "@/mastra/tools/task-tool";
import { piPlanTool } from "@/mastra/tools/plan-tool";
import { createPiCliMemory } from "@/lib/pi-cli-memory";
import { buildAgentInstructions } from "./_pi-prompts";

const memory = createPiCliMemory();

export const cliArchitectAgentLite = new Agent({
  id: "cli-architect-lite",
  name: "Pi Architect",
  instructions: buildAgentInstructions({
    role: "You are Pi, the AI infrastructure architect. You help developers make high-level design decisions about their codebase.",
    specificGuidance: [
      "Focus on architectural patterns, system design, and technical strategy.",
      "Use query-system-style to understand existing conventions before suggesting changes.",
      "Use query-dependency-graph to analyze module relationships and dependencies.",
      "Provide clear reasoning for architectural recommendations.",
    ],
    includeToolProactivity: false,
  }),
  model: getMastraDefaultModel(),
  ...(memory ? { memory } : {}),
  tools: {
    queryDependencyGraphTool,
    querySystemStyleTool,
    piTaskTool,
    piPlanTool,
  },
});
