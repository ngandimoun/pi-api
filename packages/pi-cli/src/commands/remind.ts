import * as clack from "@clack/prompts";
import chalk from "chalk";

import { executeNlpCommands } from "../lib/cli-orchestrator.js";
import { getPendingChanges } from "../lib/vcs/index.js";
import { planNaturalLanguage } from "../lib/nlp-router.js";
import type { PiNlpPlan } from "../lib/api-client.js";

export async function runRemind(cwd: string, query: string, opts?: { exec?: boolean }): Promise<void> {
  const changed = (await getPendingChanges(cwd)).slice(0, 200);

  clack.intro(chalk.inverse(" Pi "));
  const spinner = clack.spinner();
  spinner.start("Routing natural language…");
  const plan = await planNaturalLanguage({ query, changed_files: changed });
  spinner.stop("Plan ready");

  console.log(chalk.bold("\nDetected language"));
  console.log(
    `${plan.detected_language.locale} (${plan.detected_language.confidence.toFixed(2)}) — ${plan.detected_language.reasoning}`
  );

  console.log(chalk.bold("\nNormalized intent"));
  console.log(plan.normalized_intent);

  console.log(chalk.bold("\nSuggested commands"));
  for (const c of plan.routing.commands) {
    const bg = c.background ? chalk.gray(" (background)") : "";
    console.log(chalk.cyan(`- pi ${c.command}`) + (c.args.length ? ` ${c.args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}` : "") + bg);
    console.log(chalk.gray(`  ${c.rationale}`));
  }

  if (plan.routing.warnings?.length) {
    console.log(chalk.bold.yellow("\nWarnings"));
    for (const w of plan.routing.warnings) console.log(chalk.yellow(`- ${w}`));
  }

  if (opts?.exec) {
    const ok = await clack.confirm({ message: "Execute this plan now?", initialValue: false });
    if (clack.isCancel(ok) || !ok) {
      clack.outro("Cancelled.");
      return;
    }
    await executeNlpCommands(cwd, plan.routing.commands as PiNlpPlan["routing"]["commands"]);
    clack.outro("Done.");
    return;
  }

  clack.outro("Tip: rerun with `--exec` to execute the plan.");
}
