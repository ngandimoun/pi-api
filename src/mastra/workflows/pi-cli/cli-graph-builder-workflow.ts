import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { buildImportGraphFromSources } from "@/lib/pi-cli-graph";

export const cliGraphBuilderWorkflowInputSchema = z.object({
  organization_id: z.string(),
  file_sample_paths: z.array(z.string()).optional(),
  file_sources: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      })
    )
    .max(50)
    .optional(),
});

const graphSchema = z.object({
  nodes: z.array(z.object({ id: z.string(), kind: z.string() })),
  edges: z.array(z.object({ from: z.string(), to: z.string(), kind: z.string() })),
});

const buildGraphStep = createStep({
  id: "build-import-graph",
  inputSchema: cliGraphBuilderWorkflowInputSchema,
  outputSchema: z.object({
    organization_id: z.string(),
    graph: graphSchema,
    r2_object_key: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const paths = inputData.file_sample_paths ?? [];
    let graph: z.infer<typeof graphSchema>;

    if (inputData.file_sources?.length) {
      graph = buildImportGraphFromSources(inputData.file_sources);
    } else {
      const nodes = paths.slice(0, 200).map((p, i) => ({
        id: `file:${i}:${p.replace(/[^a-zA-Z0-9/_-]/g, "_")}`,
        kind: "source",
      }));
      graph = { nodes, edges: [] };
    }

    let r2_object_key: string | undefined;
    try {
      if (process.env.R2_BUCKET_NAME?.trim() || process.env.R2_PI_GRAPHS_BUCKET?.trim()) {
        const { uploadPiGraphJson } = await import("@/lib/pi-cli-r2");
        r2_object_key = await uploadPiGraphJson(inputData.organization_id, graph);
      }
    } catch (e) {
      console.warn("[cli-graph-builder-workflow] r2_upload_skipped", e);
    }

    return {
      organization_id: inputData.organization_id,
      graph,
      r2_object_key,
    };
  },
});

export const cliGraphBuilderWorkflow = createWorkflow({
  id: "cli-graph-builder-workflow",
  inputSchema: cliGraphBuilderWorkflowInputSchema,
  outputSchema: z.object({
    organization_id: z.string(),
    graph: graphSchema,
    r2_object_key: z.string().optional(),
  }),
})
  .then(buildGraphStep)
  .commit();
