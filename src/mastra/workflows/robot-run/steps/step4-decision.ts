import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import type { RobotRunInput } from "../../../../contracts/robotics-api";
import type { Incident } from "../../../../contracts/surveillance-api";
import { actionsForIncidents, extractCommands } from "../../../../lib/robotics/decision-engine";
import { ros2SendCommand } from "../../../../lib/robotics/ros2-bridge-client";
import { finishDiagnostic, startTimer } from "../debug";

export const step4Decision = createStep({
  id: "robot-step4-decision",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const input = inputData.input as RobotRunInput;
    const requestId = String((inputData as { job_id?: string }).job_id ?? "");

    const incidents = (inputData.incidents ?? []) as Incident[];
    const mappings = actionsForIncidents({ incidents, actionRules: input.actions ?? [] });

    const executedActions: Array<{ incidentId: string; ruleOn: string; errors: string[] }> = [];

    for (const m of mappings) {
      const errors: string[] = [];
      const commands = extractCommands(m.actions);
      for (const cmd of commands) {
        const res = await ros2SendCommand({
          robotId: input.robot_id,
          command: cmd,
          requestId,
        });
        if (!res.ok) errors.push(res.error ?? "command_failed");
      }
      executedActions.push({ incidentId: m.incident.id, ruleOn: m.ruleOn, errors });
    }

    const diagnostics = (inputData as { diagnostics?: unknown[] }).diagnostics ?? [];

    return {
      ...inputData,
      actions_executed: executedActions,
      diagnostics: [
        ...diagnostics,
        finishDiagnostic({
          step: "step4_decision",
          started_at: started,
          status: "ok",
          detail: {
            actions: executedActions.length,
            command_errors: executedActions.reduce((a, e) => a + e.errors.length, 0),
          },
        }),
      ],
    };
  },
});

