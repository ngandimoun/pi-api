import chalk from "chalk";

import { PiApiClient } from "./api-client.js";

export type WorkflowKey =
  | "cliValidateWorkflow"
  | "cliRoutineWorkflow"
  | "cliLearnWorkflow"
  | "cliGraphBuilderWorkflow"
  | "cliAdaptiveEngineWorkflow"
  | "cliGithubPrCheckWorkflow"
  | "cliResonateWorkflow";

export function logWorkflowSpinner(tick: number): void {
  process.stdout.write(chalk.gray(`\r… waiting for workflow (${tick})`));
}

export function logWorkflowSpinnerElapsed(tick: number, elapsedMs: number): void {
  const sec = (elapsedMs / 1000).toFixed(0);
  process.stdout.write(chalk.gray(`\r… waiting for workflow (${sec}s, tick ${tick})`));
}
