import chalk from "chalk";

import { PiApiClient } from "../lib/api-client.js";

export async function runTrace(
  runId: string,
  opts?: { workflowKey?: "cliValidateWorkflow" | "cliRoutineWorkflow" | "cliLearnWorkflow" | "cliResonateWorkflow" }
): Promise<void> {
  const client = new PiApiClient();
  const data = await client.trace({ run_id: runId, workflow_key: opts?.workflowKey });

  console.log(chalk.bold.cyan("\nPi trace\n"));
  console.log(chalk.gray("run_id:"), data.run_id);
  console.log(chalk.gray("workflow_key:"), data.workflow_key);
  console.log("");

  if (data.links?.length) {
    console.log(chalk.bold("Deep links"));
    for (const l of data.links) {
      console.log(`- ${l.label}: ${l.url}`);
    }
    console.log("");
  }

  console.log(chalk.bold("Snapshot"));
  console.log(JSON.stringify(data.snapshot, null, 2));
}
