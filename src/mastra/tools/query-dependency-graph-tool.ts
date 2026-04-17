import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { downloadLatestPiGraph } from "@/lib/pi-cli-r2";

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Traverse the latest R2-stored import graph for impact analysis.
 */
export const queryDependencyGraphTool = createTool({
  id: "query-dependency-graph",
  description:
    "Given an organization id and repo-relative file path, list dependency or dependent files from the latest Pi import graph (when available).",
  inputSchema: z.object({
    organization_id: z.string().min(1),
    file_path: z.string().min(1),
    query_type: z.enum(["dependents", "dependencies"]),
  }),
  outputSchema: z.object({
    files: z.array(z.string()),
    note: z.string().optional(),
  }),
  execute: async ({ organization_id, file_path, query_type }) => {
    const graph = await downloadLatestPiGraph(organization_id);
    if (!graph?.edges?.length) {
      return { files: [], note: "no_graph_or_empty_edges" };
    }
    const target = normalizePath(file_path);
    if (query_type === "dependencies") {
      const out = graph.edges
        .filter((e) => normalizePath(e.from) === target)
        .map((e) => e.to);
      return { files: [...new Set(out.map(normalizePath))] };
    }
    const inc = graph.edges
      .filter((e) => normalizePath(e.to) === target)
      .map((e) => e.from);
    return { files: [...new Set(inc.map(normalizePath))] };
  },
});
