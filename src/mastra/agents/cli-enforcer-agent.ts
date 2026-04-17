import { Agent } from "@mastra/core/agent";

import { getMastraDefaultModel } from "@/mastra/model";
import { extractAstSnippetTool } from "@/mastra/tools/extract-ast-tool";
import { queryDependencyGraphTool } from "@/mastra/tools/query-dependency-graph-tool";
import { querySystemStyleTool } from "@/mastra/tools/query-system-style-tool";
import { createPiCliMemory } from "@/lib/pi-cli-memory";

const memory = createPiCliMemory();

export const cliEnforcerAgent = new Agent({
  id: "cli-enforcer",
  name: "Pi CLI Enforcer",
  instructions: [
    "You enforce code quality for the Pi CLI validation pipeline.",
    "Use extract-ast-snippet when file excerpts need structure beyond plain text.",
    "Use query-system-style when system_style JSON is provided to ground rules.",
    "Use query-dependency-graph with organization_id from the workflow context and a file path to find cross-file dependents or dependencies.",
    "When producing structured output, follow the schema exactly; prefer concrete fixes over vague advice.",
  ].join("\n"),
  model: getMastraDefaultModel(),
  ...(memory ? { memory } : {}),
  tools: {
    extractAstSnippet: extractAstSnippetTool,
    querySystemStyle: querySystemStyleTool,
    queryDependencyGraph: queryDependencyGraphTool,
  },
});
