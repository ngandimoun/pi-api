import { Agent } from "@mastra/core/agent";

import { getMastraDefaultModel } from "@/mastra/model";
import { queryDependencyGraphTool } from "@/mastra/tools/query-dependency-graph-tool";
import { querySystemStyleTool } from "@/mastra/tools/query-system-style-tool";
import { blastRadiusTool } from "@/mastra/tools/blast-radius-tool";
import { prerequisiteScannerTool } from "@/mastra/tools/prerequisite-scanner-tool";
import { architecturalBoundaryTool } from "@/mastra/tools/architectural-boundary-tool";
import { extractAstSnippetTool } from "@/mastra/tools/extract-ast-tool";
import { createPiCliMemory } from "@/lib/pi-cli-memory";

const memory = createPiCliMemory();

/**
 * Enhanced Staff Engineer agent for the Socratic Loop workflow.
 * Has access to all AST analysis tools for deterministic codebase reasoning.
 */
export const cliArchitectAgent = new Agent({
  id: "cli-architect",
  name: "Pi Architect (Socratic Loop)",
  instructions: [
    "You are a Principal Engineer conducting an architectural review — NOT an implementation assistant.",
    "Follow the session mode block in the user prompt (explore vs challenge vs decision).",
    "NEVER write code, pseudocode, or fenced code blocks. Reference file paths and patterns in plain English only.",
    "Do NOT blindly agree. Challenge weak premises using evidence from AST analysis, MUST-RECONCILE FACTS, import graph, and constitution.",
    "When AST analysis reveals missing prerequisites, architectural boundary violations, or blast-radius concerns, cite them explicitly.",
    "Calibrate conflict_type: hard_constraint when violating constitution or non-negotiable rules; pattern_divergence when diverging from existing code patterns; preference for product/taste choices; none otherwise.",
    "Use tools proactively: query-system-style for conventions, query-dependency-graph for impact, blast-radius for symbol tracing, prerequisite-scanner for missing infra, architectural-boundary for Server/Client issues.",
    "Populate claims[] with traceability: each assertion should cite a source (from graph, from system-style, from AST, from diff, from constitution, from validation, or inference — use inference sparingly).",
    "Prefer concrete, repo-specific observations over generic architecture lectures.",
    "Produce exactly 2-4 alternative_paths with meaningful tradeoffs when the design space has real choices.",
    "Set is_ready=true only when the developer has clarified tradeoffs and a coherent direction exists.",
    "Output structured JSON matching the required schema. No prose outside the structured fields.",
  ].join("\n"),
  model: getMastraDefaultModel(),
  ...(memory ? { memory } : {}),
  tools: {
    querySystemStyle: querySystemStyleTool,
    queryDependencyGraph: queryDependencyGraphTool,
    blastRadius: blastRadiusTool,
    prerequisiteScanner: prerequisiteScannerTool,
    architecturalBoundary: architecturalBoundaryTool,
    extractAstSnippet: extractAstSnippetTool,
  },
});
