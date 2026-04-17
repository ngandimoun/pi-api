import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import type { RobotRunInput } from "../../../../contracts/robotics-api";
import type { BehaviorRule, PerceptionResult, StreamCreateInput } from "../../../../contracts/surveillance-api";
import { callPerceptionOrchestrator } from "../../../../lib/surveillance/perception-client";
import { finishDiagnostic, startTimer } from "../debug";

export const step1Perception = createStep({
  id: "robot-step1-perception",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const input = inputData.input as RobotRunInput;
    const requestId = String((inputData as { job_id?: string }).job_id ?? "");

    const streamId = input.perception?.source?.url?.trim()
      ? `robot:${input.robot_id}:${Buffer.from(input.perception.source.url).toString("base64url").slice(0, 16)}`
      : `robot:${input.robot_id}`;

    const streamLike: StreamCreateInput = {
      stream_id: streamId,
      source: input.perception?.source ?? { url: "robot://frame", type: "file" as const },
      detect: input.perception?.detect ?? ["person"],
      behaviors: [] as BehaviorRule[],
      anomaly: undefined,
      outputs: { delivery: ["sse"], format: "summary" },
      alerts: { min_severity: "info", cooldown_seconds: 30, group_by: "zone" },
      profile: undefined,
      context: input.context,
      input: input.perception?.input,
      frame_index: input.perception?.frame_index ?? 0,
      output: { include_diagnostics: false, format: "json" },
    };

    let perception: PerceptionResult | null = null;
    let error: string | undefined;
    try {
      const result = await callPerceptionOrchestrator({
        streamId,
        frameIndex: input.perception?.frame_index ?? 0,
        input: streamLike,
        requestId,
      });
      perception = result.perception;
      error = result.error;
    } catch (e) {
      error = e instanceof Error ? e.message : "perception_failed";
    }

    const diagnostics = (inputData as { diagnostics?: unknown[] }).diagnostics ?? [];

    if (!perception) {
      return {
        ...inputData,
        perception: null as PerceptionResult | null,
        diagnostics: [
          ...diagnostics,
          finishDiagnostic({
            step: "step1_perception",
            started_at: started,
            status: "failed",
            detail: { error: error ?? "perception_failed" },
          }),
        ],
      };
    }

    return {
      ...inputData,
      stream_id: streamId,
      perception,
      diagnostics: [
        ...diagnostics,
        finishDiagnostic({
          step: "step1_perception",
          started_at: started,
          status: "ok",
          detail: { detections: perception.detections.length, tracks: perception.tracks.length },
        }),
      ],
    };
  },
});

