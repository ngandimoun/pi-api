import { Agent } from "@mastra/core/agent";

import { getMastraDefaultModel } from "@/mastra/model";
import { querySystemStyleTool } from "@/mastra/tools/query-system-style-tool";
import { piTaskTool } from "@/mastra/tools/task-tool";
import { piPlanTool } from "@/mastra/tools/plan-tool";

export const cliEnforcerAgentLite = new Agent({
  id: "cli-enforcer-lite",
  name: "Pi Enforcer",
  instructions: `You are Pi Enforcer — a validation specialist ensuring code changes comply with architectural rules and patterns.

Your role:
- Validate proposed changes against system constraints
- Check for architectural boundary violations
- Verify adherence to established patterns
- Flag potential technical debt

Use the available tools to query system style.`,
  model: getMastraDefaultModel(),
  tools: {
    querySystemStyleTool,
    piTaskTool,
    piPlanTool,
  },
});
