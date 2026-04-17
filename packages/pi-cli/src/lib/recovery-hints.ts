import chalk from "chalk";

/**
 * After a dropped connection, timeout, or Ctrl+C mid-command, tell users how to continue
 * without redoing work from scratch. The server may still hold workflow state under `run_id`.
 */
export function printPickUpWhereYouLeftOff(opts: {
  workflowRunId?: string;
  /** Example: `pi validate` or `pi learn --async` */
  cliRetryHint?: string;
}): void {
  console.log("");
  console.log(chalk.bold.yellow("Pick up where you left off (no need to start from scratch)"));
  if (opts.workflowRunId) {
    console.log(
      chalk.dim("• Resume the cloud workflow when you are back online:"),
      chalk.cyan(`pi resume ${opts.workflowRunId}`)
    );
    console.log(chalk.dim("• Inspect run state:"), chalk.cyan(`pi trace ${opts.workflowRunId}`));
  } else {
    console.log(chalk.dim("• If you saw a run id in the logs above, run:"), chalk.cyan("pi resume <runId>"));
  }
  console.log(chalk.dim("• Steps Pi already recorded:"), chalk.cyan("pi tasks"));
  console.log(chalk.dim("• Sessions + checkpoints:"), chalk.cyan("pi tasks resume"));
  if (opts.cliRetryHint?.trim()) {
    console.log(chalk.dim("• Retry the same command after connectivity returns:"), chalk.cyan(opts.cliRetryHint.trim()));
  }
  console.log("");
}

/** One-line hint for empty `pi tasks` or footers */
export const RECOVERY_ONE_LINER =
  "Lost connection? Run " +
  "`pi tasks` — your last steps and any `pi resume <runId>` are listed when a workflow was in flight.";
