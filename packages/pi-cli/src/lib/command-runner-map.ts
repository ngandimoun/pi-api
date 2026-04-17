import chalk from "chalk";

import { runFix } from "../commands/fix.js";
import { runLearn } from "../commands/learn.js";
import { runPromptCompile } from "../commands/prompt.js";
import { runResonate } from "../commands/resonate.js";
import { runRoutineGenerate } from "../commands/routine.js";
import { runSync } from "../commands/sync.js";
import { runTrace } from "../commands/trace.js";
import { runValidate } from "../commands/validate.js";
import { runWatch } from "../commands/watch.js";

export type CommandName = "sync" | "learn" | "validate" | "fix" | "prompt" | "routine" | "resonate" | "trace" | "watch";

export type CommandRunnerOptions = {
  cwd: string;
  intent?: string;
  flags?: Set<string>;
  args?: string[];
  fromOmniRouter?: boolean;
  workflow?: boolean;
  plan?: boolean;
};

/**
 * Unified command execution map shared by omni-router and cli-orchestrator.
 * This ensures consistent behavior across all NLP routing paths.
 */
export const commandRunnerMap: Record<CommandName, (opts: CommandRunnerOptions) => Promise<void>> = {
  async sync(opts) {
    const includeGraph = !opts.flags?.has("--no-graph");
    await runSync(opts.cwd, { includeGraph });
  },

  async learn(opts) {
    const withGraph = opts.flags?.has("--with-graph") ?? false;
    const async = opts.flags?.has("--async") ?? false;
    await runLearn(opts.cwd, undefined, { withGraph, async });
  },

  async validate(opts) {
    const since = opts.flags?.has("--staged") ? "staged" : "head";
    const json = opts.flags?.has("--json") ?? false;
    const strict = opts.flags?.has("--strict") ?? false;
    const async = opts.flags?.has("--async") ?? false;
    await runValidate(opts.cwd, {
      intent: opts.intent,
      since,
      json,
      strict,
      async,
    });
  },

  async fix(opts) {
    const since = opts.flags?.has("--staged") ? "staged" : "head";
    await runFix(opts.cwd, { since });
  },

  async prompt(opts) {
    const intent = opts.intent ?? opts.args?.join(" ").trim();
    if (!intent) throw new Error("prompt requires intent");
    const raw = opts.flags?.has("--raw") ?? false;
    const noCopy = opts.flags?.has("--no-copy") ?? false;
    await runPromptCompile(opts.cwd, intent, { raw, noCopy });
  },

  async routine(opts) {
    const intent = opts.intent ?? opts.args?.join(" ").trim();
    if (!intent) throw new Error("routine requires intent");
    const async = opts.flags?.has("--async") ?? false;
    const approval = opts.flags?.has("--approval") ?? false;
    await runRoutineGenerate(opts.cwd, intent, [], { async, approval });
  },

  async resonate(opts) {
    const intent = opts.intent ?? opts.args?.join(" ").trim();
    if (!intent) throw new Error("resonate requires intent");
    const workflow = opts.workflow ?? opts.flags?.has("--workflow") ?? false;
    const plan = opts.plan ?? opts.flags?.has("--plan") ?? false;
    await runResonate(opts.cwd, intent, {
      workflow,
      plan,
      fromOmniRouter: opts.fromOmniRouter,
    });
  },

  async trace(opts) {
    const runId = opts.args?.[0];
    if (!runId) {
      console.log(chalk.yellow("⚠ trace requires a run ID; skipping"));
      return;
    }
    const wf = opts.args?.[1];
    await runTrace(runId, {
      workflowKey:
        wf === "cliRoutineWorkflow" ||
        wf === "cliLearnWorkflow" ||
        wf === "cliResonateWorkflow" ||
        wf === "cliValidateWorkflow"
          ? wf
          : undefined,
    });
  },

  async watch(opts) {
    if (opts.fromOmniRouter) {
      console.log(chalk.yellow("⚠ watch is a long-running process; use `pi watch` directly"));
      return;
    }
    await runWatch(opts.cwd, {});
  },
};

/**
 * Execute a command using the unified runner map.
 */
export async function executeCommand(
  command: CommandName,
  opts: CommandRunnerOptions
): Promise<void> {
  const runner = commandRunnerMap[command];
  if (!runner) {
    console.log(chalk.yellow(`⚠ Unknown command: ${command}`));
    return;
  }
  await runner(opts);
}
