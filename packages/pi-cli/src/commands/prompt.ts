import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import process from "node:process";
import chalk from "chalk";
import clipboard from "clipboardy";

import { PiApiClient } from "../lib/api-client.js";
import { ensurePiDir, ensureSystemStyleJson, ensureTeamSyncIfNeeded, type PreFlightGlobalOpts } from "../lib/dependency-chain.js";
import { PI_PROMPT_CACHE_DIR, SYSTEM_STYLE_FILE } from "../lib/constants.js";
import { CommandTaskTracker } from "../lib/task-tracker.js";
import { getCurrentBranch } from "../lib/vcs/index.js";
import { collectRoutineRepoContext } from "../lib/routine-repo-context.js";
import { touchPromptActivity } from "../lib/cli-activity.js";
import { recordPiApiCall } from "../lib/token-budget.js";

export type PromptCompileCliOpts = PreFlightGlobalOpts & {
  raw?: boolean;
  noCopy?: boolean;
  withExcerpts?: boolean;
};

/** Matches server `slugFromIntent` in pi-cli-routine-generate. */
export function slugFromIntentLocal(intent: string): string {
  return (
    intent
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "routine"
  );
}

/**
 * Resolve intent from `pi prompt [intent]` plus any extra args after the verb.
 */
export function resolvePromptIntent(
  intentArg: string | undefined,
  argvAfterVerb: string[]
): string {
  const fromPos = intentArg?.trim() ?? "";
  const fromArgv = argvAfterVerb.join(" ").trim();
  return fromPos || fromArgv;
}

function extractBoldHeadings(text: string): Set<string> {
  const set = new Set<string>();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("**")) {
      const end = t.indexOf("**", 2);
      if (end > 2) set.add(t.slice(0, end + 2));
    }
  }
  return set;
}

function buildDiffNote(oldText: string, nextText: string): string | null {
  const oldH = extractBoldHeadings(oldText);
  const nextH = extractBoldHeadings(nextText);
  const added = [...nextH].filter((x) => !oldH.has(x));
  const removed = [...oldH].filter((x) => !nextH.has(x));
  const parts: string[] = [];
  if (added.length) {
    parts.push(
      `+${added
        .slice(0, 5)
        .map((s) => s.replace(/\*\*/g, "").slice(0, 40))
        .join(", ")}`
    );
  }
  if (removed.length) {
    parts.push(
      `−${removed
        .slice(0, 5)
        .map((s) => s.replace(/\*\*/g, "").slice(0, 40))
        .join(", ")}`
    );
  }
  if (!parts.length) return null;
  return parts.join(" · ");
}

async function readLastPrompt(cwd: string, slug: string): Promise<string | null> {
  const file = path.join(cwd, PI_PROMPT_CACHE_DIR, `${slug}.txt`);
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function savePrompt(cwd: string, slug: string, text: string): Promise<void> {
  const dir = path.join(cwd, PI_PROMPT_CACHE_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${slug}.txt`), text, "utf8");
}

function printContextQualityBadge(q: "rich" | "partial" | "thin"): void {
  if (q === "rich") {
    console.log(chalk.green("◆ Context quality: rich"));
  } else if (q === "partial") {
    console.log(chalk.yellow("◆ Context quality: partial — run `pi learn` (and `--with-graph`) for stronger grounding"));
  } else {
    console.log(
      chalk.red("◆ Context quality: thin — run `pi learn` first; graph/memory will improve this prompt")
    );
  }
}

async function maybeAskFeedback(
  client: PiApiClient,
  params: {
    intent: string;
    intent_slug: string;
    thread_id?: string;
    branch_name: string;
    developer_id?: string;
  }
): Promise<void> {
  if (!process.stdin.isTTY) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = (await rl.question(chalk.dim("Was this prompt useful? [y/n] (Enter to skip) "))).trim().toLowerCase();
    if (ans === "y" || ans === "yes") {
      try {
        await client.promptFeedback({
          intent: params.intent,
          intent_slug: params.intent_slug,
          feedback: "up",
          thread_id: params.thread_id,
          branch_name: params.branch_name,
          developer_id: params.developer_id,
        });
        console.log(chalk.gray("(Thanks — saved to Pi memory for better prompts next time.)"));
      } catch {
        console.log(chalk.gray("(Could not save feedback — try again later.)"));
      }
    } else if (ans === "n" || ans === "no") {
      try {
        await client.promptFeedback({
          intent: params.intent,
          intent_slug: params.intent_slug,
          feedback: "down",
          thread_id: params.thread_id,
          branch_name: params.branch_name,
          developer_id: params.developer_id,
        });
        console.log(chalk.gray("(Noted — we'll try to improve recall for similar intents.)"));
      } catch {
        console.log(chalk.gray("(Could not save feedback — try again later.)"));
      }
    }
  } catch {
    /* ignore */
  } finally {
    rl.close();
  }
}

export async function runPromptCompile(
  cwd: string,
  intent: string,
  opts?: PromptCompileCliOpts
): Promise<void> {
  await ensurePiDir(cwd, opts);
  await ensureTeamSyncIfNeeded(cwd, opts);
  await ensureSystemStyleJson(cwd, opts);

  const client = new PiApiClient();

  let system_style: Record<string, unknown> | undefined;
  let hadSystemStyleFile = false;
  try {
    const raw = await fs.readFile(path.join(cwd, SYSTEM_STYLE_FILE), "utf8");
    system_style = JSON.parse(raw) as Record<string, unknown>;
    hadSystemStyleFile = true;
  } catch {
    system_style = undefined;
  }

  const branch_name = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const developer_id = process.env.PI_CLI_DEVELOPER_ID?.trim() || undefined;

  const tracker = new CommandTaskTracker("prompt", `Prompt: ${intent.slice(0, 100)}`, { cwd, branch: branch_name });
  tracker.startStep("context", "Collect routine context");
  const previewSlug = slugFromIntentLocal(intent);
  const lastPromptSnapshot = await readLastPrompt(cwd, previewSlug);

  if (!opts?.raw) {
    console.log(chalk.cyan(`◐ Analyzing intent: "${intent.slice(0, 120)}${intent.length > 120 ? "…" : ""}"...`));
  }

  const routine_context = await collectRoutineRepoContext(cwd, intent, {
    withExcerpts: Boolean(opts?.withExcerpts),
  });
  tracker.completeStep("context");
  tracker.startStep("api", "Compile prompt (API)");

  if (!opts?.raw) {
    console.log(chalk.cyan("◒ Scanning codebase for relevant patterns..."));
    console.log(chalk.cyan("◑ Recalling past architectural preferences (server)..."));
  }

  type PromptGen = {
    compiled_prompt: string;
    intent_slug: string;
    thread_id?: string;
    context_quality: "rich" | "partial" | "thin";
    memory_highlight?: string;
  };

  // Budget check
  const budget = await recordPiApiCall(cwd, "prompt");
  if (!budget.ok) {
    console.error(chalk.red(budget.warn));
    return;
  }
  if (budget.warn) {
    console.log(chalk.yellow(`⚠ ${budget.warn}`));
  }

  let data: PromptGen;
  try {
    data = await client.promptGenerate({
      intent,
      system_style,
      branch_name,
      developer_id,
      routine_context,
    });
  } catch (e) {
    tracker.fail(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error(chalk.red(msg));
    if (msg.includes("API key") || msg.includes("401") || msg.includes("403")) {
      console.log(chalk.dim("Fix: run `pi auth-login --api-key <key>` or set PI_API_KEY."));
    }
    if (msg.includes("Gemini") || msg.includes("GOOGLE_GENERATIVE_AI")) {
      console.log(chalk.dim("Fix: server needs GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_KEY for prompt compilation."));
    }
    process.exitCode = 1;
    return;
  }

  const text = data.compiled_prompt;
  const diffNote =
    lastPromptSnapshot && lastPromptSnapshot !== text ? buildDiffNote(lastPromptSnapshot, text) : null;

  await savePrompt(cwd, data.intent_slug, text);

  if (opts?.raw) {
    console.log(text);
    tracker.completeStep("api");
    await touchPromptActivity(cwd);
    tracker.complete();
    return;
  }

  if (!hadSystemStyleFile || !system_style || Object.keys(system_style).length === 0) {
    console.log(chalk.yellow("Hint: run `pi learn` so prompts include your repo’s real conventions."));
  }

  printContextQualityBadge(data.context_quality);

  if (data.memory_highlight?.trim()) {
    const one = data.memory_highlight.trim().replace(/\s+/g, " ");
    console.log(chalk.magenta(`◈ From memory: ${one.slice(0, 200)}${one.length > 200 ? "…" : ""}`));
  }

  if (diffNote) {
    console.log(chalk.cyan(`◉ Updated from last run: ${diffNote}`));
  }

  console.log("");
  console.log(chalk.bold.green("✅ Perfect Prompt Compiled!"));
  console.log("");
  console.log(chalk.dim("━".repeat(56)));
  console.log(text);
  console.log(chalk.dim("━".repeat(56)));
  console.log("");

  const shouldCopy = process.stdin.isTTY && !opts?.noCopy;
  if (shouldCopy) {
    try {
      await clipboard.write(text);
      console.log(chalk.yellow("📋 Copied to clipboard."));
    } catch {
      console.log(chalk.gray("(Could not copy to clipboard — select the prompt above manually.)"));
    }
  } else if (opts?.noCopy) {
    console.log(chalk.gray("(Clipboard copy skipped: --no-copy)"));
  } else {
    console.log(chalk.gray("(Non-TTY: clipboard skipped; pipe with --raw for scripts.)"));
  }

  console.log("");
  console.log(chalk.bold("Paste targets"));
  console.log(chalk.dim("  Cursor — Composer / Agent:"), chalk.white("Cmd/Ctrl+V"));
  console.log(
    chalk.dim("  Claude Code / Codex / other CLIs:"),
    chalk.white('run pi prompt --raw "<same intent>" and copy the stdout (TTY already copied when possible)')
  );
  console.log(chalk.dim("  Windsurf — Cascade:"), chalk.white("paste like Cursor"));
  console.log("");
  console.log(chalk.bold("Next:"));
  console.log(chalk.dim(`  pi routine "${intent.replace(/"/g, '\\"')}"   → lock the spec for your team`));
  console.log(chalk.dim(`  pi validate              → audit before PR`));
  console.log("");

  await maybeAskFeedback(client, {
    intent,
    intent_slug: data.intent_slug,
    thread_id: data.thread_id,
    branch_name,
    developer_id,
  });

  tracker.completeStep("api");
  await touchPromptActivity(cwd);
  tracker.complete();
}
