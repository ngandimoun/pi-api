import chalk from "chalk";

import { RECOVERY_ONE_LINER } from "../lib/recovery-hints.js";
import { fingerprintCwd, loadSessions, type PiCliSessionRecord } from "../lib/session-store.js";
import {
  findRootTaskId,
  getActiveTasksForRepo,
  getTaskById,
  getTaskTree,
  getTasksForSession,
  pruneCompletedTasksManual,
  type PiTask,
} from "../lib/task-store.js";

function formatTaskLine(t: PiTask): string {
  const age = new Date(t.created_at).toISOString().slice(0, 19);
  return `${chalk.cyan(t.task_id)}  ${chalk.dim(t.status)}  ${chalk.dim(age)}  ${t.description}`;
}

export async function runTasksCommand(
  cwd: string,
  action?: string,
  id?: string
): Promise<void> {
  const act = (action ?? "list").toLowerCase();
  const fp = fingerprintCwd(cwd);

  if (act === "list" || act === "ls" || act === "") {
    const rows = getActiveTasksForRepo(cwd);
    if (!rows.length) {
      console.log(chalk.dim("No active tasks for this repo (pending/running)."));
      console.log(chalk.dim("Tasks are recorded when you run validate, learn, routine, prompt, fix, sync, resonate."));
      console.log("");
      console.log(chalk.dim(RECOVERY_ONE_LINER));
      return;
    }
    console.log(chalk.bold("\nActive Pi tasks (this repo)\n"));
    for (const t of rows.slice(0, 50)) {
      console.log(formatTaskLine(t));
      console.log(chalk.dim(`  command: ${t.command}  branch: ${t.context.branch}`));
      if (t.context.workflow_run_id && !t.parent_task_id) {
        console.log(
          chalk.dim("  continue workflow:"),
          chalk.cyan(`pi resume ${t.context.workflow_run_id}`),
          chalk.dim("(after reconnect — server may still hold this run)")
        );
      }
      console.log("");
    }
    console.log(chalk.dim("Details: "), chalk.cyan("pi tasks show <task_id>"));
    console.log("");
    console.log(chalk.dim(RECOVERY_ONE_LINER));
    return;
  }

  if (act === "show") {
    if (!id?.trim()) {
      console.error(chalk.red("Usage: pi tasks show <task_id>"));
      process.exitCode = 1;
      return;
    }
    const t = getTaskById(id.trim());
    if (!t || t.context.cwd_fingerprint !== fp) {
      console.error(chalk.red("Task not found for this repo."));
      process.exitCode = 1;
      return;
    }
    console.log(chalk.bold("\nTask\n"));
    console.log(JSON.stringify(t, null, 2));
    const tree = getTaskTree(findRootTaskId(t.task_id));
    const subs = tree.filter((x) => x.parent_task_id);
    if (subs.length) {
      console.log(chalk.bold("\nSteps\n"));
      for (const s of subs) {
        console.log(`  [${s.status}] ${s.description}`);
      }
    }
    return;
  }

  if (act === "tree") {
    if (!id?.trim()) {
      console.error(chalk.red("Usage: pi tasks tree <root_task_id>"));
      process.exitCode = 1;
      return;
    }
    const tree = getTaskTree(id.trim());
    if (!tree.length || tree[0].context.cwd_fingerprint !== fp) {
      console.error(chalk.red("Task tree not found for this repo."));
      process.exitCode = 1;
      return;
    }
    for (const n of tree) {
      const pad = n.parent_task_id ? "  " : "";
      console.log(`${pad}${chalk.cyan(n.status)}  ${n.description}`);
    }
    return;
  }

  if (act === "clean") {
    const n = pruneCompletedTasksManual();
    console.log(chalk.green("✓"), `Pruned old completed tasks (${n} removed).`);
    return;
  }

  if (act === "resume") {
    await runTasksResume(cwd, id?.trim());
    return;
  }

  console.error(chalk.red("Unknown action. Use: pi tasks | pi tasks show <id> | pi tasks tree <id> | pi tasks clean | pi tasks resume [session_id]"));
  process.exitCode = 1;
}

async function runTasksResume(cwd: string, sessionId?: string): Promise<void> {
  const fp = fingerprintCwd(cwd);
  let sessions: PiCliSessionRecord[];

  if (sessionId) {
    const s = loadSessions().find((x) => x.session_id === sessionId && x.cwd_fingerprint === fp);
    sessions = s ? [s] : [];
    if (!sessions.length) {
      console.error(chalk.red("Session not found for this repo."));
      process.exitCode = 1;
      return;
    }
  } else {
    sessions = loadSessions()
      .filter((s) => s.cwd_fingerprint === fp && s.status !== "abandoned")
      .filter((s) => {
        const tasks = getTasksForSession(s.session_id);
        return tasks.some((t) => t.status === "pending" || t.status === "running");
      })
      .slice(0, 10);
    if (!sessions.length) {
      console.log(chalk.dim("No sessions with in-progress tasks for this repo."));
      console.log(chalk.dim("Workflow runs: use "), chalk.cyan("pi resume <runId>"), chalk.dim("for suspended Mastra workflows."));
      console.log(chalk.dim("Resonate: use "), chalk.cyan('pi resonate "<msg>" --session <id>'));
      return;
    }
  }

  // If there's exactly one session and it has a workflow checkpoint, auto-resume it
  if (sessions.length === 1 && sessionId && sessions[0].last_checkpoint?.workflow_run_id) {
    const workflowRunId = sessions[0].last_checkpoint.workflow_run_id;
    console.log(chalk.cyan(`\nResuming workflow ${workflowRunId}...`));
    const { runResumeWorkflowById } = await import("./execute.js");
    await runResumeWorkflowById(cwd, workflowRunId);
    return;
  }

  for (const s of sessions) {
    console.log(chalk.bold(`\nSession ${s.session_id}`));
    console.log(chalk.dim(`  branch: ${s.branch_name}  status: ${s.status}`));
    console.log(chalk.dim(`  intent: ${s.intent_summary.slice(0, 120)}`));
    const tasks = getTasksForSession(s.session_id);
    for (const t of tasks) {
      console.log(`  • [${t.status}] ${t.command}: ${t.description}`);
      if (t.context.workflow_run_id) {
        console.log(chalk.cyan(`    → pi resume ${t.context.workflow_run_id}`), chalk.dim("(if workflow suspended)"));
      }
    }
    if (s.last_checkpoint?.workflow_run_id) {
      console.log(chalk.yellow("\nCheckpoint:"), s.last_checkpoint);
      console.log(chalk.dim("Resume workflow directly:"), chalk.cyan(`pi tasks resume ${s.session_id}`));
    } else {
      console.log(chalk.dim("\nNo workflow checkpoint stored. Continue with:"));
      console.log(chalk.cyan(`  pi resonate "<your reply>" --session ${s.session_id}`));
    }
  }
}
