import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import type { RobotBehaviorRule, RobotRunInput } from "../../../../contracts/robotics-api";
import type { Incident, PerceptionResult } from "../../../../contracts/surveillance-api";
import { evaluateBehaviorRules } from "../../../../lib/surveillance/policy-engine";
import { finishDiagnostic, startTimer } from "../debug";

const surveillanceBehaviorTypes = [
  "loitering",
  "intrusion",
  "crowd_growth",
  "object_left",
  "perimeter_breach",
  "speed_violation",
  "wrong_direction",
] as const;

export const step3BehaviorEval = createStep({
  id: "robot-step3-behavior-eval",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const input = inputData.input as RobotRunInput;
    const perception = inputData.perception as PerceptionResult | null;
    const diagnostics = (inputData as { diagnostics?: unknown[] }).diagnostics ?? [];

    if (!perception) {
      return {
        ...inputData,
        incidents: [] as Incident[],
        diagnostics: [
          ...diagnostics,
          finishDiagnostic({
            step: "step3_behavior_eval",
            started_at: started,
            status: "failed",
            detail: { error: "missing_perception" },
          }),
        ],
      };
    }

    // Reuse existing surveillance DSL evaluation for supported behaviors.
    const surveillanceBehaviors = (input.behaviors ?? []).filter((b): b is any =>
      (surveillanceBehaviorTypes as readonly string[]).includes(b.type)
    );

    const incidents = evaluateBehaviorRules({
      perception,
      behaviors: surveillanceBehaviors as any,
      ctx: {
        nowMs: Date.now(),
        streamId: String(inputData.stream_id ?? perception.stream_id),
        zones: undefined,
      },
      trackState: (inputData.track_state ?? {}) as any,
    });

    return {
      ...inputData,
      incidents,
      diagnostics: [
        ...diagnostics,
        finishDiagnostic({
          step: "step3_behavior_eval",
          started_at: started,
          status: "ok",
          detail: { incidents: incidents.length },
        }),
      ],
    };
  },
});

