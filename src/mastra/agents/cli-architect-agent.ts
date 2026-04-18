import { Agent } from "@mastra/core/agent";

import { getMastraDefaultModel } from "@/mastra/model";
import { queryDependencyGraphTool } from "@/mastra/tools/query-dependency-graph-tool";
import { querySystemStyleTool } from "@/mastra/tools/query-system-style-tool";
import { blastRadiusTool } from "@/mastra/tools/blast-radius-tool";
import { prerequisiteScannerTool } from "@/mastra/tools/prerequisite-scanner-tool";
import { architecturalBoundaryTool } from "@/mastra/tools/architectural-boundary-tool";
import { extractAstSnippetTool } from "@/mastra/tools/extract-ast-tool";
import { piTaskTool } from "@/mastra/tools/task-tool";
import { piPlanTool } from "@/mastra/tools/plan-tool";
import { createPiCliMemory } from "@/lib/pi-cli-memory";
import { buildAgentInstructions } from "./_pi-prompts";

const memory = createPiCliMemory();

/** Exported for Pi CLI Hokage production verification tests. */
export const cliArchitectAgentTools = {
  querySystemStyle: querySystemStyleTool,
  queryDependencyGraph: queryDependencyGraphTool,
  blastRadius: blastRadiusTool,
  prerequisiteScanner: prerequisiteScannerTool,
  architecturalBoundary: architecturalBoundaryTool,
  extractAstSnippet: extractAstSnippetTool,
  piTask: piTaskTool,
  piPlan: piPlanTool,
} as const;

/** Stable tool ids for Pi CLI Hokage production verification (`tests/mastra/*`). */
export const CLI_ARCHITECT_AGENT_TOOL_IDS = Object.keys(cliArchitectAgentTools) as Array<
  keyof typeof cliArchitectAgentTools
>;

/**
 * Enhanced Staff Engineer agent for the Socratic Loop workflow.
 * Has access to all AST analysis tools for deterministic codebase reasoning.
 */
export const cliArchitectAgent = new Agent({
  id: "cli-architect",
  name: "Pi Architect (Socratic Loop)",
  instructions: buildAgentInstructions({
    role: "You are a Principal Engineer conducting an architectural review — NOT an implementation assistant.",
    specificGuidance: [
      "When AST analysis reveals missing prerequisites, architectural boundary violations, or blast-radius concerns, cite them explicitly.",
      "Produce exactly 2-4 alternative_paths with meaningful tradeoffs when the design space has real choices.",
    ],
    includeToolProactivity: true,
  }),
  model: getMastraDefaultModel(),
  ...(memory ? { memory } : {}),
  tools: { ...cliArchitectAgentTools },
});
