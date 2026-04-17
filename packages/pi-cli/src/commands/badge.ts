import chalk from "chalk";
import clipboardy from "clipboardy";
import { addBadgeToReadme, formatBadgeMarkdown } from "../lib/badge-generator.js";

export type BadgeCliOpts = {
  /** Print markdown only */
  dryRun?: boolean;
  /** Copy badge markdown to clipboard */
  copy?: boolean;
  /** Shields dynamic image URL (optional) */
  dynamicUrl?: string;
};

export async function runBadge(cwd: string, opts?: BadgeCliOpts): Promise<void> {
  const dry = Boolean(opts?.dryRun);
  const md = formatBadgeMarkdown(opts?.dynamicUrl);

  if (dry) {
    console.log(md);
    return;
  }

  const r = await addBadgeToReadme(cwd, opts?.dynamicUrl);
  if (r.action === "skipped") {
    console.log(chalk.yellow(r.reason ?? "Skipped"));
    process.exitCode = 1;
    return;
  }
  console.log(chalk.green(`✓ ${r.action}`), chalk.dim(r.path));
  if (opts?.copy) {
    await clipboardy.write(md);
    console.log(chalk.dim("Copied badge markdown to clipboard."));
  }
}
