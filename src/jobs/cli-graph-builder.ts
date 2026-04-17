import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { mastra } from "@/mastra";

const payloadSchema = z.object({
  organizationId: z.string().min(1),
  fileSamplePaths: z.array(z.string()).max(500).optional(),
  fileSources: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      })
    )
    .max(50)
    .optional(),
});

/**
 * Background: build / refresh codebase dependency graph metadata (Chakra Network).
 */
export const cliGraphBuilder = task({
  id: "cli-graph-builder",
  run: async (payload: unknown) => {
    const p = payloadSchema.parse(payload);
    try {
      const wf = mastra.getWorkflow("cliGraphBuilderWorkflow");
      const run = await wf.createRun({ resourceId: p.organizationId });
      const result = await run.start({
        inputData: {
          organization_id: p.organizationId,
          file_sample_paths: p.fileSamplePaths,
          file_sources: p.fileSources,
        },
      });
      if (result.status === "success") {
        return {
          ok: true as const,
          organizationId: p.organizationId,
          sampled: p.fileSamplePaths?.length ?? 0,
          graph: result.result,
        };
      }
      return {
        ok: false as const,
        organizationId: p.organizationId,
        sampled: p.fileSamplePaths?.length ?? 0,
        status: result.status,
      };
    } catch (e) {
      console.warn("[cli-graph-builder] workflow_failed", e);
      return {
        ok: true as const,
        organizationId: p.organizationId,
        sampled: p.fileSamplePaths?.length ?? 0,
        note: "Mastra workflow unavailable; placeholder result.",
      };
    }
  },
});
