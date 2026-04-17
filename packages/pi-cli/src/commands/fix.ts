import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";

import { createSharinganProject } from "../lib/ast/sharingan.js";
import { ensurePiDir, type PreFlightGlobalOpts } from "../lib/dependency-chain.js";
import { listChangedTsJsFiles, collectDeterministicViolationsForFiles } from "../lib/deterministic-scan.js";
import { applyAutofixesForViolations } from "../lib/fix-autofix.js";
import { CommandTaskTracker } from "../lib/task-tracker.js";
import { getCurrentBranch } from "../lib/vcs/index.js";
import { runDeterministicRulesWithContext } from "../lib/rules/deterministic.js";
import { buildDefaultRuleRuntimeContext } from "../lib/rules/rule-loader.js";
import {
  filterViolationsByPatchConfidence,
  generateDeterministicPatches,
} from "../lib/rules/patch-generator.js";

export async function runFix(
  cwd: string,
  opts?: {
    since?: "staged" | "head";
    paths?: string[];
    dryRun?: boolean;
    /** Prompt before writing each file (y/N). */
    interactive?: boolean;
    /** Only apply fixes whose patch confidence is >= this (0–1). Default 0. */
    confidenceThreshold?: number;
  } & PreFlightGlobalOpts
): Promise<void> {
  const since = opts?.since ?? "head";

  await ensurePiDir(cwd, { noAuto: opts?.noAuto });

  const branch = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const tracker = new CommandTaskTracker("fix", "Deterministic autofix", { cwd, branch });
  tracker.startStep("list", "List changed TS/JS files");

  const files = await listChangedTsJsFiles(cwd, since, opts?.paths);
  tracker.completeStep("list");

  if (!files.length) {
    tracker.complete();
    console.log(chalk.gray("No matching files to fix."));
    return;
  }

  tracker.startStep("scan", "Validate with Sharingan rules");
  console.log(chalk.dim("◐ Deterministic validation pass (same rules as `pi check`)…"));
  const ruleCtx = await buildDefaultRuleRuntimeContext(cwd);
  const preViolations = await collectDeterministicViolationsForFiles(cwd, files, ruleCtx);
  tracker.completeStep("scan");
  if (!preViolations.length) {
    tracker.complete();
    console.log(chalk.gray("No deterministic rule violations to fix."));
    return;
  }
  console.log(
    chalk.dim(`◑ Found ${preViolations.length} finding(s) across changed files — applying safe autofixes…`)
  );

  tracker.startStep("apply", "Apply autofixes");
  const sharingan = createSharinganProject(cwd);
  const sourceFiles = sharingan.addSourceFiles(files);

  const threshold = opts?.confidenceThreshold ?? 0;
  const interactive = Boolean(opts?.interactive);

  let totalFixed = 0;
  for (const sf of sourceFiles) {
    let violations = runDeterministicRulesWithContext(sf, ruleCtx);
    if (!violations.length) continue;

    const patches = generateDeterministicPatches(sf, violations);
    violations = filterViolationsByPatchConfidence(violations, patches, threshold);
    if (!violations.length) continue;

    if (interactive && !opts?.dryRun) {
      const rl = readline.createInterface({ input, output });
      try {
        const rel = path.relative(cwd, sf.getFilePath());
        const ans = await rl.question(
          chalk.cyan(`Apply ${violations.length} deterministic fix(es) to ${rel}? [y/N] `)
        );
        if (!/^y(es)?$/i.test(ans.trim())) {
          console.log(chalk.dim("  skipped"));
          continue;
        }
      } finally {
        rl.close();
      }
    }

    const before = sf.getFullText();
    const { fixed } = applyAutofixesForViolations(sf, violations);
    const after = sf.getFullText();

    if (fixed > 0 && before !== after) {
      totalFixed += fixed;
      if (!opts?.dryRun) {
        await sf.save();
        console.log(chalk.green("✓"), `Fixed ${fixed} issue(s) in`, path.relative(cwd, sf.getFilePath()));
      } else {
        console.log(chalk.cyan("dry-run:"), `Would fix ${fixed} issue(s) in`, path.relative(cwd, sf.getFilePath()));
      }
    }
  }

  if (totalFixed === 0) {
    console.log(chalk.gray("No deterministic autofixes applied."));
  }
  tracker.completeStep("apply");
  tracker.complete();
}
