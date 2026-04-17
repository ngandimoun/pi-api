import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { SYSTEM_STYLE_FILE } from "./constants.js";

export type ContextHealthStatus = {
  hasSystemStyle: boolean;
  systemStyleAge?: number;
  isStale: boolean;
  reasons: string[];
  suggestions: string[];
};

/**
 * Check if Pi's context is healthy or needs refresh.
 * Returns health status and actionable suggestions.
 */
export async function checkContextHealth(cwd: string): Promise<ContextHealthStatus> {
  const reasons: string[] = [];
  const suggestions: string[] = [];
  let hasSystemStyle = false;
  let systemStyleAge: number | undefined;
  let isStale = false;

  // Check if system-style.json exists and is recent
  try {
    const stylePath = path.join(cwd, SYSTEM_STYLE_FILE);
    const stats = await fs.stat(stylePath);
    hasSystemStyle = true;
    systemStyleAge = Date.now() - stats.mtimeMs;

    // Consider stale if older than 7 days
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (systemStyleAge > SEVEN_DAYS) {
      isStale = true;
      const daysOld = Math.floor(systemStyleAge / (24 * 60 * 60 * 1000));
      reasons.push(`System style is ${daysOld} days old`);
      suggestions.push("Run `pi learn` to refresh codebase understanding");
    }

    // Check if it's empty or minimal
    const content = await fs.readFile(stylePath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed || Object.keys(parsed).length < 3) {
      isStale = true;
      reasons.push("System style has minimal data");
      suggestions.push("Run `pi learn --with-graph` for deeper context");
    }
  } catch {
    // No system style file
    isStale = true;
    reasons.push("Pi hasn't learned your codebase yet");
    suggestions.push("Run `pi learn` to scan your repo (takes ~10s)");
  }

  // Check if package.json changed recently (indicates new dependencies)
  try {
    const pkgPath = path.join(cwd, "package.json");
    const pkgStats = await fs.stat(pkgPath);
    const pkgAge = Date.now() - pkgStats.mtimeMs;

    // If package.json changed in last 24h but system-style is older
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (pkgAge < ONE_DAY && (!systemStyleAge || systemStyleAge > pkgAge)) {
      isStale = true;
      reasons.push("Dependencies changed since last learn");
      suggestions.push("Run `pi learn` to update context with new packages");
    }
  } catch {
    // No package.json - not a fatal issue
  }

  return {
    hasSystemStyle,
    systemStyleAge,
    isStale,
    reasons,
    suggestions,
  };
}

/**
 * Display context health warning if needed, with actionable suggestions.
 */
export function displayContextHealthWarning(health: ContextHealthStatus): void {
  if (!health.isStale) return;

  console.log("");
  console.log(chalk.yellow("⚠️  Context may be stale"));
  for (const reason of health.reasons) {
    console.log(chalk.dim(`   • ${reason}`));
  }
  console.log("");
  console.log(chalk.bold("💡 Suggestions:"));
  for (const suggestion of health.suggestions) {
    console.log(chalk.cyan(`   ${suggestion}`));
  }
  console.log("");
}

/**
 * Automatically suggest running pi learn if context is critically stale.
 */
export async function autoSuggestLearn(cwd: string, opts?: { interactive?: boolean }): Promise<boolean> {
  const health = await checkContextHealth(cwd);
  
  if (!health.isStale) return false;

  if (!health.hasSystemStyle) {
    // Critical: no context at all
    displayContextHealthWarning(health);
    
    if (opts?.interactive && process.stdin.isTTY) {
      const { confirm } = await import("@clack/prompts");
      const shouldLearn = await confirm({
        message: "Run `pi learn` now to build context?",
        initialValue: true,
      });
      
      if (shouldLearn && typeof shouldLearn === "boolean") {
        console.log(chalk.dim("◐ Running pi learn..."));
        const { runLearn } = await import("../commands/learn.js");
        await runLearn(cwd, undefined, {});
        return true;
      }
    }
  } else if (health.reasons.length > 0) {
    // Non-critical but recommended
    displayContextHealthWarning(health);
  }

  return false;
}
