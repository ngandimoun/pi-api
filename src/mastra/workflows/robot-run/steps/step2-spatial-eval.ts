import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import type { RobotRunInput, RobotState } from "../../../../contracts/robotics-api";
import { ros2GetState } from "../../../../lib/robotics/ros2-bridge-client";
import { zonesContainingPoint } from "../../../../lib/robotics/spatial-engine";
import { finishDiagnostic, startTimer } from "../debug";

export const step2SpatialEval = createStep({
  id: "robot-step2-spatial-eval",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const input = inputData.input as RobotRunInput;
    const requestId = String((inputData as { job_id?: string }).job_id ?? "");

    const { state, error } = await ros2GetState({ robotId: input.robot_id, requestId });
    const diagnostics = (inputData as { diagnostics?: unknown[] }).diagnostics ?? [];

    const robotState = (state ?? null) as RobotState | null;

    const inZones =
      robotState?.position?.x != null && robotState?.position?.y != null
        ? zonesContainingPoint({
            point: { x: Number(robotState.position.x), y: Number(robotState.position.y) },
            zones: input.zones ?? [],
            frame: robotState.position.frame ?? undefined,
          }).map((z) => z.name)
        : [];

    return {
      ...inputData,
      robot_state: robotState,
      spatial: { zones: inZones },
      diagnostics: [
        ...diagnostics,
        finishDiagnostic({
          step: "step2_spatial_eval",
          started_at: started,
          status: robotState ? "ok" : "failed",
          detail: { error: error ?? null, zones: inZones },
        }),
      ],
    };
  },
});

