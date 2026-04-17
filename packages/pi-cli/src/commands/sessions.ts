import chalk from "chalk";

import { loadSessions, markSessionAbandoned, formatSessionAge, fingerprintCwd } from "../lib/session-store.js";

export async function runSessionsList(cwd: string): Promise<void> {
  const fp = fingerprintCwd(cwd);
  const rows = loadSessions()
    .filter((s) => s.cwd_fingerprint === fp)
    .sort((a, b) => b.last_updated - a.last_updated);

  if (!rows.length) {
    console.log(chalk.dim("No saved Pi sessions for this repo path."));
    console.log(chalk.dim("Sessions are created when you run ") + chalk.cyan('pi "…"') + chalk.dim(" or ") + chalk.cyan("pi resonate"));
    return;
  }

  console.log(chalk.bold("\nPi sessions (this machine / this repo path)\n"));
  for (const s of rows.slice(0, 30)) {
    const line = s.last_pi_message.replace(/\s+/g, " ").slice(0, 100);
    console.log(
      chalk.cyan(`• ${s.session_id}`) +
        chalk.dim(`  ${s.status}  branch=${s.branch_name}  ${formatSessionAge(s.last_updated)}`)
    );
    console.log(chalk.dim(`  intent: ${s.intent_summary.slice(0, 120)}${s.intent_summary.length > 120 ? "…" : ""}`));
    console.log(chalk.dim(`  last:   ${line}${line.length >= 100 ? "…" : ""}`));
    console.log("");
  }
  console.log(chalk.dim("Forget: "), chalk.cyan("pi sessions forget <session_id>"));
}

export async function runSessionsForget(cwd: string, sessionId: string): Promise<void> {
  const fp = fingerprintCwd(cwd);
  const rows = loadSessions();
  const hit = rows.find((s) => s.session_id === sessionId && s.cwd_fingerprint === fp);
  if (!hit) {
    console.error(chalk.red("Session not found for this repo (or wrong id)."));
    process.exitCode = 1;
    return;
  }
  markSessionAbandoned(sessionId);
  console.log(chalk.green("✓"), "Session marked abandoned:", sessionId);
}
