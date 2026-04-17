import chalk from "chalk";
import * as clack from "@clack/prompts";

import { runInit } from "./init.js";
import { runLearn } from "./learn.js";
import { runSync } from "./sync.js";
import { runValidate } from "./validate.js";
import { runFix } from "./fix.js";
import { runResonate } from "./resonate.js";
import { getApiKey } from "../lib/config.js";
import { needsLearnCheck, pathExists } from "../lib/dependency-chain.js";
import { PI_DIR, PI_LAST_VALIDATE_RESULT } from "../lib/constants.js";
import path from "node:path";

type FlowName = "setup" | "check-and-fix" | "full-check";

type FlowStep = {
  name: string;
  description: string;
  run: (cwd: string) => Promise<void>;
  condition?: (cwd: string) => Promise<boolean>;
};

/**
 * Define named pipelines that chain commands with shared context
 */
const flows: Record<FlowName, FlowStep[]> = {
  setup: [
    {
      name: "init",
      description: "Initialize .pi/ directory",
      run: async (cwd) => {
        await runInit(cwd);
      },
      condition: async (cwd) => {
        return !(await pathExists(path.join(cwd, PI_DIR)));
      },
    },
    {
      name: "sync",
      description: "Pull team artifacts from cloud",
      run: async (cwd) => {
        await runSync(cwd, { includeGraph: true });
      },
      condition: async (cwd) => {
        return Boolean(getApiKey());
      },
    },
    {
      name: "learn",
      description: "Scan codebase and build system-style",
      run: async (cwd) => {
        await runLearn(cwd, undefined, { withGraph: true });
      },
      condition: async (cwd) => {
        const { needsLearn } = await needsLearnCheck(cwd);
        return needsLearn && Boolean(getApiKey());
      },
    },
  ],

  "check-and-fix": [
    {
      name: "validate",
      description: "Run full validation (deterministic + semantic)",
      run: async (cwd) => {
        await runValidate(cwd, { since: "head" });
      },
    },
    {
      name: "fix",
      description: "Apply deterministic autofixes",
      run: async (cwd) => {
        await runFix(cwd, { since: "head" });
      },
      condition: async (cwd) => {
        // Only run fix if validate found issues
        const resultPath = path.join(cwd, PI_LAST_VALIDATE_RESULT);
        if (!(await pathExists(resultPath))) return false;
        try {
          const fs = await import("node:fs/promises");
          const content = await fs.readFile(resultPath, "utf8");
          const result = JSON.parse(content) as { autofix_available?: boolean };
          return result.autofix_available === true;
        } catch {
          return false;
        }
      },
    },
    {
      name: "resonate",
      description: "Get AI assistance for remaining issues",
      run: async (cwd) => {
        // Auto-load violations from validate
        await runResonate(cwd, "Help me fix the remaining validation issues", {
          fromOmniRouter: false,
        });
      },
      condition: async (cwd) => {
        // Only run resonate if there are still violations after fix
        const resultPath = path.join(cwd, PI_LAST_VALIDATE_RESULT);
        if (!(await pathExists(resultPath))) return false;
        try {
          const fs = await import("node:fs/promises");
          const content = await fs.readFile(resultPath, "utf8");
          const result = JSON.parse(content) as {
            local?: unknown[];
            semantic?: unknown[];
            drift?: unknown[];
          };
          const totalViolations =
            (result.local?.length ?? 0) + (result.semantic?.length ?? 0) + (result.drift?.length ?? 0);
          return totalViolations > 0;
        } catch {
          return false;
        }
      },
    },
  ],

  "full-check": [
    {
      name: "doctor",
      description: "Check Pi CLI readiness",
      run: async (cwd) => {
        const { runDoctor } = await import("./doctor.js");
        await runDoctor(cwd, { fix: true });
      },
    },
    {
      name: "validate",
      description: "Run full validation",
      run: async (cwd) => {
        await runValidate(cwd, { since: "head", strict: true });
      },
    },
  ],
};

export async function runFlow(cwd: string, flowName?: string): Promise<void> {
  if (!flowName) {
    console.log(chalk.bold.cyan("\n  Pi Flow — Named Pipelines\n"));
    console.log(chalk.dim("Available flows:\n"));
    console.log(chalk.cyan("  setup") + chalk.dim("          Initialize Pi CLI (init → sync → learn)"));
    console.log(chalk.cyan("  check-and-fix") + chalk.dim("   Validate → fix → resonate (full dev loop)"));
    console.log(chalk.cyan("  full-check") + chalk.dim("     Doctor → validate (CI-friendly)"));
    console.log(chalk.dim("\nUsage: ") + chalk.cyan("pi flow <name>"));
    console.log("");
    return;
  }

  const normalizedName = flowName.toLowerCase() as FlowName;
  const flow = flows[normalizedName];

  if (!flow) {
    console.error(chalk.red(`Unknown flow: ${flowName}`));
    console.log(chalk.dim("Available flows: ") + chalk.cyan(Object.keys(flows).join(", ")));
    process.exitCode = 1;
    return;
  }

  clack.intro(chalk.cyan(`Pi flow: ${normalizedName}`));

  const stepsToRun: FlowStep[] = [];
  for (const step of flow) {
    if (step.condition) {
      const shouldRun = await step.condition(cwd);
      if (!shouldRun) {
        console.log(chalk.dim(`  ○ ${step.name} — ${step.description} (skipped)`));
        continue;
      }
    }
    stepsToRun.push(step);
  }

  if (stepsToRun.length === 0) {
    clack.outro(chalk.green("Flow complete — all steps already satisfied!"));
    return;
  }

  console.log(chalk.bold(`\n  Plan (${stepsToRun.length} steps):\n`));
  for (let i = 0; i < stepsToRun.length; i++) {
    console.log(chalk.cyan(`  ${i + 1}. ${stepsToRun[i].name}`) + chalk.dim(` — ${stepsToRun[i].description}`));
  }
  console.log("");

  for (let i = 0; i < stepsToRun.length; i++) {
    const step = stepsToRun[i];
    const stepNum = i + 1;
    const spinner = clack.spinner();
    spinner.start(chalk.cyan(`Step ${stepNum}/${stepsToRun.length}: ${step.name}`) + chalk.dim(` — ${step.description}`));

    try {
      await step.run(cwd);
      spinner.stop(chalk.green(`✓ Step ${stepNum}: ${step.name}`));
    } catch (e) {
      spinner.stop(chalk.red(`✗ Step ${stepNum}: ${step.name} failed`));
      console.error(chalk.red(e instanceof Error ? e.message : String(e)));
      console.log(chalk.yellow(`\nFlow stopped at step ${stepNum}. Fix the issue and rerun.`));
      process.exitCode = 1;
      return;
    }
  }

  clack.outro(chalk.green(`Flow complete — all ${stepsToRun.length} steps succeeded!`));
}
