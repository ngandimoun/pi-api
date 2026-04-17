import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { mastra } from "@/mastra";

const payloadSchema = z.object({
  organizationId: z.string().min(1),
  libraryHint: z.string().min(1),
  intentConfidence: z.number().min(0).max(1).optional(),
});

/**
 * Sage Mode — adaptive analysis for unknown stacks (placeholder; extend with Firecrawl + LLM).
 */
export const cliAdaptiveEngine = task({
  id: "cli-adaptive-engine",
  run: async (payload: unknown) => {
    const p = payloadSchema.parse(payload);
    try {
      const wf = mastra.getWorkflow("cliAdaptiveEngineWorkflow");
      const run = await wf.createRun({ resourceId: p.organizationId });
      const result = await run.start({
        inputData: {
          organization_id: p.organizationId,
          library_hint: p.libraryHint,
          intent_confidence: p.intentConfidence,
        },
      });
      if (result.status === "success") {
        return {
          ok: true as const,
          organizationId: p.organizationId,
          libraryHint: p.libraryHint,
          workflow: result.result,
        };
      }
      return {
        ok: false as const,
        organizationId: p.organizationId,
        status: result.status,
      };
    } catch (e) {
      console.warn("[cli-adaptive-engine] workflow_failed", e);
      return {
        ok: true as const,
        organizationId: p.organizationId,
        libraryHint: p.libraryHint,
        note: "Adaptive spec generation can be extended with Firecrawl + structured output.",
      };
    }
  },
});
