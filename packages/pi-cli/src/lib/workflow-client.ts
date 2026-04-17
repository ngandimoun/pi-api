import chalk from "chalk";

import { PiApiClient } from "./api-client.js";
import type { WorkflowKey } from "./workflow-poller.js";

export type PollTerminalResult = {
  status: string;
  workflow_run?: unknown;
  workflow_result?: unknown;
  suspend_payload?: unknown;
};

/**
 * Poll `/api/cli/workflow/poll` until the run reaches a terminal state.
 */
export async function pollWorkflowUntilTerminal(
  client: PiApiClient,
  workflowKey: WorkflowKey,
  runId: string,
  opts?: {
    intervalMs?: number;
    timeoutMs?: number;
    onTick?: (n: number, elapsedMs: number) => void;
  }
): Promise<PollTerminalResult> {
  const intervalMs = opts?.intervalMs ?? 2000;
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const start = Date.now();
  let n = 0;
  for (;;) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Workflow poll timed out after ${timeoutMs}ms (${workflowKey} ${runId}).`);
    }
    n += 1;
    opts?.onTick?.(n, Date.now() - start);
    const data = await client.workflowPoll({ workflow_key: workflowKey, run_id: runId });
    const st = data.status?.toLowerCase() ?? "";
    if (st === "success" || st === "failed" || st === "suspended") {
      return {
        status: data.status,
        workflow_run: data.workflow_run,
        workflow_result: data.workflow_result,
        suspend_payload: data.suspend_payload,
      };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export function logWorkflowSpinnerTick(tick: number, elapsedMs: number): void {
  const sec = (elapsedMs / 1000).toFixed(0);
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const frame = frames[tick % frames.length];
  process.stdout.write(chalk.cyan(`\r${frame} Pi is thinking... ${chalk.gray(`(${sec}s)`)}`));
}

/**
 * Enhanced workflow ticker with phase information
 */
export function logWorkflowSpinnerTickWithPhase(tick: number, elapsedMs: number, phase?: string): void {
  const sec = (elapsedMs / 1000).toFixed(0);
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const frame = frames[tick % frames.length];
  const phaseText = phase ? chalk.dim(` — ${phase}`) : "";
  process.stdout.write(chalk.cyan(`\r${frame} Pi is thinking... ${chalk.gray(`(${sec}s)`)}${phaseText}`));
}
