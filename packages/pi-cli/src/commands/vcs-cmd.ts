import chalk from "chalk";

import { clearVcsAdapterCache, detectVcsType, getVcs } from "../lib/vcs/index.js";

export async function runVcsInfo(cwd: string): Promise<void> {
  clearVcsAdapterCache(cwd);
  const detected = await detectVcsType(cwd);
  const vcs = await getVcs(cwd);

  console.log(chalk.bold("\nPi VCS\n"));
  console.log(chalk.cyan("Detected type:"), detected);
  console.log(chalk.cyan("Active adapter:"), vcs.name);
  console.log(chalk.cyan("Capabilities:"), JSON.stringify(vcs.capabilities, null, 2));

  try {
    const branch = await vcs.getCurrentBranch();
    console.log(chalk.cyan("Branch / workspace:"), branch ?? chalk.dim("(none)"));
  } catch (e) {
    console.log(chalk.yellow("Branch / workspace:"), e instanceof Error ? e.message : e);
  }

  console.log("");
  console.log(chalk.dim("Override in "), chalk.cyan(".pi/config.json"), chalk.dim(' → `"vcs": { "type": "git" | "perforce" | ... }`'));
  console.log("");
}
