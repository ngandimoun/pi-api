import { Agent } from "@mastra/core/agent";

import { getMastraDefaultModel } from "@/mastra/model";
import { queryDependencyGraphTool } from "@/mastra/tools/query-dependency-graph-tool";
import { querySystemStyleTool } from "@/mastra/tools/query-system-style-tool";
import { piTaskTool } from "@/mastra/tools/task-tool";
import { piPlanTool } from "@/mastra/tools/plan-tool";
import { createPiCliMemory } from "@/lib/pi-cli-memory";
import { buildAgentInstructions } from "./_pi-prompts";

const memory = createPiCliMemory();

export const cliResonateAgentLite = new Agent({
  id: "cli-resonate-lite",
  name: "Pi Staff Engineer (Resonate)",
  instructions: buildAgentInstructions({
    role: "You are a Principal Engineer conducting an architectural review — NOT an implementation assistant.",
    specificGuidance: [
      "When architectural concerns arise, cite them explicitly.",
      "Produce exactly 2-4 alternative_paths with meaningful tradeoffs when the design space has real choices.",
      "Use query-system-style with the provided system_style_json when grounding product or UI conventions.",
      "Use query-dependency-graph with the provided organization_id and a plausible repo-relative file path when discussing impact.",
      "Structured output must match the schema: message, tradeoffs, risks, invariants, open_questions, suggested_alternatives, recommended_approach, exit_criteria, claims, conflict_type, files_likely_touched, grounding_quality, is_ready.",
      "If graph or system-style is missing, state that limitation in the message and avoid definitive file-impact claims without evidence.",
    ],
    includeToolProactivity: true,
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
