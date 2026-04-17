import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";

import { PiApiClient } from "../lib/api-client.js";
import { PI_DIR, SYSTEM_STYLE_FILE } from "../lib/constants.js";
import { CommandTaskTracker } from "../lib/task-tracker.js";
import { getCurrentBranch } from "../lib/vcs/index.js";

const GRAPH_LATEST_FILE = path.join(PI_DIR, "graph-latest.json");

export async function runSync(
  cwd: string,
  opts?: { includeGraph?: boolean }
): Promise<void> {
  const client = new PiApiClient();
  const include_graph = opts?.includeGraph ?? true;

  const branch = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const tracker = new CommandTaskTracker("sync", "Pull team artifacts from cloud", { cwd, branch });
  tracker.startStep("fetch", "Fetch sync payload");
  const data = await client.syncFetch({ include_graph });
  tracker.completeStep("fetch");
  tracker.startStep("write", "Write .pi/ artifacts");

  await fs.mkdir(path.join(cwd, PI_DIR), { recursive: true });

  if (data.system_style) {
    await fs.writeFile(path.join(cwd, SYSTEM_STYLE_FILE), JSON.stringify(data.system_style, null, 2), "utf8");
    console.log(chalk.green("✓"), "Wrote", SYSTEM_STYLE_FILE);
  } else {
    console.log(chalk.yellow("!"), "No remote system_style found (skipping).");
  }

  if (include_graph) {
    if (data.graph) {
      await fs.writeFile(path.join(cwd, GRAPH_LATEST_FILE), JSON.stringify(data.graph, null, 2), "utf8");
      console.log(chalk.green("✓"), "Wrote", path.relative(cwd, GRAPH_LATEST_FILE));
    } else {
      console.log(chalk.yellow("!"), "No remote graph found (skipping).");
    }
  }
  tracker.completeStep("write");
  tracker.complete();
}
