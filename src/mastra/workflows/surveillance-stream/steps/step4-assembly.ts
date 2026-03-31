import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { streamAnalysisOutputSchema } from "../../../../contracts/surveillance-api";
import type { Incident, PerceptionResult } from "../../../../contracts/surveillance-api";
import { pushIncident } from "../../../../lib/surveillance/incident-store";
import { finishDiagnostic, startTimer } from "../debug";
import { surveillanceStreamWorkflowOutputSchema } from "../schemas";

export const step4Assembly = createStep({
  id: "surveillance-step4-assembly",
  inputSchema: z.any(),
  outputSchema: surveillanceStreamWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const perception = inputData.perception as PerceptionResult;
    const incidents = (inputData.incidents_narrated ?? inputData.incidents ?? []) as Incident[];
    const orgId = String(inputData.organization_id ?? "");
    const diagnostics = (inputData as { diagnostics?: unknown[] }).diagnostics ?? [];

    for (const inc of incidents) {
      try {
        await pushIncident({ orgId, incident: inc });
      } catch {
        // Non-fatal: SSE may still work without DB in some environments
      }
    }

    const output = streamAnalysisOutputSchema.parse({
      stream_id: String(inputData.stream_id ?? perception.stream_id),
      perception,
      incidents,
    });

    return surveillanceStreamWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...diagnostics,
        finishDiagnostic({
          step: "step4_assembly",
          started_at: started,
          status: "ok",
          detail: { incidents: incidents.length },
        }),
      ],
    });
  },
});
