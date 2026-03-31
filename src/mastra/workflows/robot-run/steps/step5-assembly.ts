import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { robotActionSchema, robotRunOutputSchema } from "../../../../contracts/robotics-api";
import type { RobotAction, RobotRunInput, RobotState } from "../../../../contracts/robotics-api";
import type { Incident, PerceptionResult } from "../../../../contracts/surveillance-api";
import { pushIncident } from "../../../../lib/surveillance/incident-store";
import { finishDiagnostic, startTimer } from "../debug";
import { robotRunWorkflowOutputSchema } from "../schemas";

export const step5Assembly = createStep({
  id: "robot-step5-assembly",
  inputSchema: z.any(),
  outputSchema: robotRunWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const input = inputData.input as RobotRunInput;
    const diagnostics = (inputData as { diagnostics?: unknown[] }).diagnostics ?? [];

    const perception = inputData.perception as PerceptionResult | null;
    const incidents = (inputData.incidents ?? []) as Incident[];
    const orgId = String(inputData.organization_id ?? "");

    for (const inc of incidents) {
      try {
        await pushIncident({ orgId, incident: inc });
      } catch {
        // non-fatal
      }
    }

    const actionsExecuted = Array.isArray(inputData.actions_executed)
      ? (inputData.actions_executed as unknown[])
      : [];
    const actionObjects: RobotAction[] = [];
    // We only return the action definitions (not internal execution details) for the dev API.
    for (const rule of input.actions ?? []) {
      for (const act of rule.do ?? []) {
        const parsed = robotActionSchema.safeParse(act);
        if (parsed.success) actionObjects.push(parsed.data);
      }
    }

    const state = (inputData.robot_state ?? null) as RobotState | null;

    const output = robotRunOutputSchema.parse({
      robot_id: input.robot_id,
      task: input.task,
      state: state ?? undefined,
      incidents,
      actions_executed: actionObjects,
      perception: perception ?? undefined,
      actions_execution: actionsExecuted,
    });

    return robotRunWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...diagnostics,
        finishDiagnostic({
          step: "step5_assembly",
          started_at: started,
          status: "ok",
          detail: { incidents: incidents.length },
        }),
      ],
    });
  },
});

