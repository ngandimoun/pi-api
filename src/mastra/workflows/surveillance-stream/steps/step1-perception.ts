import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { perceptionResultSchema } from "../../../../contracts/surveillance-api";
import { callPerceptionOrchestrator } from "../../../../lib/surveillance/perception-client";
import { finishDiagnostic, startTimer } from "../debug";
import { surveillanceStreamWorkflowInputSchema } from "../schemas";

export const step1Perception = createStep({
  id: "surveillance-step1-perception",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const input = surveillanceStreamWorkflowInputSchema.parse(inputData);
    const streamId =
      input.input.stream_id?.trim() ||
      `stream_${input.job_id.replace(/-/g, "").slice(0, 12)}`;

    try {
      const result = await callPerceptionOrchestrator({
        streamId,
        frameIndex: input.input.frame_index ?? 0,
        input: input.input,
        requestId: input.job_id,
      });

      if (!result.perception) {
        throw new Error(result.error ?? "perception_unavailable");
      }

      return {
        ...inputData,
        stream_id: streamId,
        perception: result.perception,
        diagnostics: [
          ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
          finishDiagnostic({
            step: "step1_perception",
            started_at: started,
            status: "ok",
            detail: { detections: result.perception.detections.length, tracks: result.perception.tracks.length },
          }),
        ],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "perception_failed";
      // Fail-fast: a surveillance job should not be marked completed without perception.
      throw new Error(`surveillance_perception_failed: ${msg}`);
    }
  },
});
