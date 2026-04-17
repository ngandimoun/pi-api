import fs from "node:fs/promises";
import path from "node:path";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";

const PI_PLAN_FILE = ".pi-plan.md";

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort checks inferred from step text (no network). Adds trust receipts to the plan.
 */
async function runStepReceipts(cwd: string, stepBody: string): Promise<string[]> {
  const lines: string[] = [];
  const lower = stepBody.toLowerCase();
  const pkgPath = path.join(cwd, "package.json");
  if (!(await fileExists(pkgPath))) return lines;

  let scripts: Record<string, string> = {};
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as { scripts?: Record<string, string> };
    scripts = pkg.scripts ?? {};
  } catch {
    return lines;
  }

  const run = async (cmd: string, args: string[], label: string) => {
    try {
      const result = await execa(cmd, args, { cwd, reject: false });
      const ok = result.exitCode === 0;
      lines.push(`${ok ? "✓" : "✗"} **${label}** — exit code ${result.exitCode}`);
      if (!ok && result.stderr?.trim()) {
        lines.push(`  \`\`\`\n${result.stderr.trim().slice(0, 800)}\n  \`\`\``);
      }
    } catch (e) {
      lines.push(`? **${label}** — ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (lower.includes("prisma") && (await fileExists(path.join(cwd, "prisma", "schema.prisma")))) {
    await run("npx", ["prisma", "validate"], "prisma validate");
  }

  if ((lower.includes("typecheck") || lower.includes("typescript") || lower.includes(" tsc")) && scripts.typecheck) {
    await run("npm", ["run", "typecheck"], "npm run typecheck");
  } else if (
    (lower.includes("typescript") || lower.includes("typecheck")) &&
    (await fileExists(path.join(cwd, "tsconfig.json")))
  ) {
    await run("npx", ["tsc", "--noEmit"], "npx tsc --noEmit");
  }

  if ((lower.includes("lint") || lower.includes("eslint")) && scripts.lint) {
    await run("npm", ["run", "lint"], "npm run lint");
  }

  if (lower.includes("format") && scripts.format) {
    await run("npm", ["run", "format"], "npm run format");
  }

  return lines;
}

type PlanStep = {
  number: number;
  title: string;
  body: string;
  status: "pending" | "done";
};

function parsePlanSteps(markdown: string): PlanStep[] {
  const steps: PlanStep[] = [];
  const re = /^## Step (\d+):\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  const matches: { index: number; num: number; title: string }[] = [];

  while ((match = re.exec(markdown)) !== null) {
    matches.push({ index: match.index, num: parseInt(match[1], 10), title: match[2] });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    const body = markdown.slice(start, end).trim();
    const isDone = body.includes("[x]") || body.includes("**Status:** Done");
    steps.push({
      number: matches[i].num,
      title: matches[i].title,
      body,
      status: isDone ? "done" : "pending",
    });
  }

  return steps;
}

export async function runExecute(cwd: string, stepArg?: string): Promise<void> {
  const planPath = path.join(cwd, PI_PLAN_FILE);
  let planContent: string;

  try {
    planContent = await fs.readFile(planPath, "utf8");
  } catch {
    console.error(chalk.red(`No .pi-plan.md found. Run \`pi resonate --plan\` or \`pi resonate --workflow\` first.`));
    process.exitCode = 1;
    return;
  }

  const steps = parsePlanSteps(planContent);
  if (steps.length === 0) {
    console.error(chalk.red("No steps found in .pi-plan.md."));
    process.exitCode = 1;
    return;
  }

  if (!stepArg) {
    clack.intro(chalk.cyan("pi execute — Shadow Plan"));
    console.log(chalk.bold(`\nPlan: ${PI_PLAN_FILE}`));
    console.log(chalk.dim(`${steps.length} steps total\n`));

    for (const step of steps) {
      const icon = step.status === "done" ? chalk.green("[done]") : chalk.yellow("[pending]");
      console.log(`  ${icon} Step ${step.number}: ${step.title}`);
    }

    const pending = steps.filter((s) => s.status === "pending");
    if (pending.length === 0) {
      console.log(chalk.green("\nAll steps complete!"));
    } else {
      console.log(chalk.dim(`\nNext: pi execute ${pending[0].number}`));
    }
    clack.outro("");
    return;
  }

  const stepNum = parseInt(stepArg, 10);
  const step = steps.find((s) => s.number === stepNum);
  if (!step) {
    console.error(chalk.red(`Step ${stepArg} not found in .pi-plan.md.`));
    process.exitCode = 1;
    return;
  }

  if (step.status === "done") {
    console.log(chalk.yellow(`Step ${stepNum} is already marked as done.`));
    return;
  }

  clack.intro(chalk.cyan(`pi execute — Step ${stepNum}`));
  console.log(chalk.bold(step.title));
  console.log("");
  console.log(step.body);
  console.log("");

  const confirm = await clack.confirm({
    message: `Mark Step ${stepNum} as done?`,
  });

  if (clack.isCancel(confirm) || !confirm) {
    clack.outro(chalk.dim("Step not marked."));
    return;
  }

  const spin = clack.spinner();
  spin.start("Running validation receipts (best-effort)…");
  let receiptLines: string[] = [];
  try {
    receiptLines = await runStepReceipts(cwd, step.body);
  } catch {
    receiptLines = [];
  }
  spin.stop(receiptLines.length ? `Receipts: ${receiptLines.length} line(s)` : "No matching checks for this step.");

  const stepHeader = `## Step ${stepNum}: ${step.title}`;
  const headerIdx = planContent.indexOf(stepHeader);
  if (headerIdx >= 0) {
    const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
    const receiptBlock =
      receiptLines.length > 0 ?
        `\n### Receipt (${ts})\n\n${receiptLines.join("\n\n")}\n`
      : "";

    const updatedContent =
      planContent.slice(0, headerIdx) +
      `## Step ${stepNum}: ${step.title}\n**Status:** Done\n${receiptBlock}` +
      planContent.slice(headerIdx + stepHeader.length + 1);
    await fs.writeFile(planPath, updatedContent, "utf8");
  }

  console.log(chalk.green(`✓ Step ${stepNum} marked as done.`));
  if (receiptLines.length) {
    console.log(chalk.dim("Receipts appended under this step in .pi-plan.md"));
  }

  const nextPending = steps.find((s) => s.number > stepNum && s.status === "pending");
  if (nextPending) {
    console.log(chalk.dim(`→ Next: pi execute ${nextPending.number}`));
  } else {
    const allDone = steps.every((s) => s.number === stepNum || s.status === "done");
    if (allDone) {
      console.log(chalk.green("All steps complete!"));

      const statusLine = "**Status:** Pending Execution";
      if (planContent.includes(statusLine)) {
        const finalContent = (await fs.readFile(planPath, "utf8")).replace(statusLine, "**Status:** Execution Complete");
        await fs.writeFile(planPath, finalContent, "utf8");
      }
    }
  }

  clack.outro("");
}

export async function runResumeWorkflow(cwd: string): Promise<void> {
  console.log(chalk.dim("Looking for suspended workflow runs..."));

  const { PiApiClient } = await import("../lib/api-client.js");
  const client = new PiApiClient();

  console.log(
    chalk.yellow(
      "pi resume requires a run_id. Use: pi resume <run_id>\n" +
      "The run_id is shown when a workflow suspends during pi resonate --workflow."
    )
  );
}

export async function runResumeWorkflowById(_cwd: string, runId: string): Promise<void> {
  const { PiApiClient } = await import("../lib/api-client.js");
  const client = new PiApiClient();

  const s = clack.spinner();
  s.start("Detecting workflow type and polling state...");

  // Try all known workflow keys to find the right one
  const workflowKeys = [
    "cliResonateWorkflow",
    "cliValidateWorkflow",
    "cliRoutineWorkflow",
    "cliLearnWorkflow",
  ];

  let state: Awaited<ReturnType<typeof client.workflowPoll>> | null = null;
  let detectedWorkflow: string | null = null;

  for (const workflowKey of workflowKeys) {
    try {
      state = await client.workflowPoll({
        workflow_key: workflowKey as "cliResonateWorkflow" | "cliValidateWorkflow" | "cliRoutineWorkflow" | "cliLearnWorkflow",
        run_id: runId,
      });
      detectedWorkflow = workflowKey;
      break;
    } catch (e) {
      // Try next workflow key
      continue;
    }
  }

  if (!state || !detectedWorkflow) {
    s.stop("Failed.");
    console.error(chalk.red(`Could not find workflow with run_id: ${runId}`));
    console.log(chalk.dim("The run may have expired or the run_id is invalid."));
    process.exitCode = 1;
    return;
  }

  s.stop(`Found ${detectedWorkflow} workflow.`);

  if (state.status !== "suspended") {
    console.log(chalk.dim(`Workflow status: ${state.status}`));
    if (state.status === "success" && state.workflow_result) {
      const result = state.workflow_result as Record<string, unknown>;
      if (result.shadow_plan_markdown) {
        console.log(chalk.green("Workflow completed. Shadow plan available."));
      }
    }
    return;
  }

  const resumeCommand = detectedWorkflow === "cliResonateWorkflow" 
    ? "pi resonate --workflow --resume <session_id>"
    : `pi ${detectedWorkflow.replace("cli", "").replace("Workflow", "").toLowerCase()} --async --resume ${runId}`;
    
  console.log(chalk.cyan(`Workflow is suspended (${detectedWorkflow}).`));
  console.log(chalk.dim(`Resume hint: ${resumeCommand}`));
}
