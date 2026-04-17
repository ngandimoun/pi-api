import chalk from "chalk";
import { RasenganCache } from "../lib/cache/rasengan-cache.js";
import { getBudgetStats } from "../lib/token-budget.js";

export async function runCacheClear(cwd: string, level: "all" | "memory" | "disk"): Promise<void> {
  const c = new RasenganCache(cwd);
  if (level === "memory" || level === "all") await c.clearMemory();
  if (level === "disk" || level === "all") await c.clearDisk();
  console.log(chalk.green("✓"), `Rasengan cache cleared (${level}).`);
}

export async function runCacheStats(cwd: string): Promise<void> {
  const b = await getBudgetStats(cwd);
  console.log(chalk.bold("Pi cache / budget"));
  console.log(chalk.dim("  hour bucket:"), b.hour);
  console.log(chalk.dim("  validate API calls (this hour):"), String(b.validate_calls));
  console.log(chalk.gray("  (validate budget: PI_CLI_MAX_API_CALLS_PER_HOUR, PI_CLI_MAX_API_CALLS_PER_HOUR_HARD)"));
}
