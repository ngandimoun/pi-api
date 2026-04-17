import chalk from "chalk";

/**
 * Explains what works without local Postgres / workflow infra.
 * Pi CLI talks to the Pi API; Mastra memory + suspend/resume need server-side DB + flags.
 */
export function printLocalFirstBanner(opts?: { workflow?: boolean }): void {
  console.log(chalk.dim("─".repeat(56)));
  console.log(
    chalk.bold("Pi mode:"),
    opts?.workflow
      ? chalk.yellow("Socratic workflow")
      : chalk.green("Standard resonate (API)")
  );
  console.log(
    chalk.dim(
      "  • No Postgres required on your machine — context lives on the Pi API you call."
    )
  );
  if (opts?.workflow) {
    console.log(
      chalk.dim(
        "  • Workflow suspend/resume needs the server: PI_CLI_USE_WORKFLOWS=true + DATABASE_URL (Postgres)."
      )
    );
    console.log(
      chalk.yellow(
        "  • If workflow start fails, Pi falls back to standard resonate automatically."
      )
    );
  } else {
    console.log(
      chalk.dim(
        "  • Mastra memory / semantic recall on the server still needs DATABASE_URL + keys — run `pi doctor` for hints."
      )
    );
  }
  console.log(chalk.dim("─".repeat(56)));
  console.log("");
}
