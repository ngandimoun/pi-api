import chalk from "chalk";
import { execa } from "execa";

import { executeCommand, type CommandName } from "./command-runner-map.js";

type NlpCommand = {
  command: string;
  rationale: string;
  args: string[];
  background?: boolean;
};

function splitFlags(args: string[]): { flags: Set<string>; rest: string[] } {
  const flags = new Set<string>();
  const rest: string[] = [];
  for (const a of args) {
    if (a.startsWith("--")) flags.add(a);
    else rest.push(a);
  }
  return { flags, rest };
}

function printCommand(cmd: NlpCommand) {
  const quotedArgs = cmd.args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a));
  const line = `pi ${cmd.command}${quotedArgs.length ? ` ${quotedArgs.join(" ")}` : ""}`;
  console.log(chalk.bold(line));
  console.log(chalk.gray(cmd.rationale));
  console.log("");
}

export async function executeNlpCommands(cwd: string, commands: NlpCommand[]): Promise<void> {
  for (const cmd of commands) {
    printCommand(cmd);

    const validCommands = new Set<string>([
      "sync",
      "learn",
      "validate",
      "fix",
      "prompt",
      "routine",
      "resonate",
      "trace",
      "watch",
    ]);

    if (!validCommands.has(cmd.command)) {
      console.log(chalk.yellow(`Unknown planned command: ${cmd.command} (skipping)`));
      continue;
    }

    // Special handling for background watch
    if (cmd.command === "watch" && cmd.background) {
      void execa("pi", ["watch"], { cwd, stdio: "ignore", detached: true }).catch(() => {
        /* ignore */
      });
      console.log(chalk.gray("(started `pi watch` in background)"));
      continue;
    }

    const { flags, rest } = splitFlags(cmd.args);
    const intent = rest.join(" ").trim() || undefined;

    await executeCommand(cmd.command as CommandName, {
      cwd,
      intent,
      flags,
      args: rest,
    });
  }
}
