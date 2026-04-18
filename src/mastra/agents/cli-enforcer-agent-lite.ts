import { Agent } from "@mastra/core/agent";

import { getMastraDefaultModel } from "@/mastra/model";
import { queryDependencyGraphTool } from "@/mastra/tools/query-dependency-graph-tool";
import { querySystemStyleTool } from "@/mastra/tools/query-system-style-tool";
import { piTaskTool } from "@/mastra/tools/task-tool";
import { piPlanTool } from "@/mastra/tools/plan-tool";
import { createPiCliMemory } from "@/lib/pi-cli-memory";

const memory = createPiCliMemory();

export const cliEnforcerAgentLite = new Agent({
  id: "cli-enforcer-lite",
  name: "Pi Enforcer",
  instructions: `You are Pi Enforcer — a validation specialist ensuring code changes comply with architectural rules and patterns.

Your role:
- Validate proposed changes against system constraints
- Check for architectural boundary violations
- Verify adherence to established patterns
- Flag potential technical debt

Use the available tools to query system style and dependency relationships.`,
  model: getMastraDefaultModel(),
  ...(memory ? { memory } : {}),
  tools: {
    queryDependencyGraphTool,
    querySystemStyleTool,
    piTaskTool,
    piPlanTool,
  },
});
