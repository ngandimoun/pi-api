import * as clack from "@clack/prompts";
import chalk from "chalk";

import { runResonate } from "../commands/resonate.js";
import { executeCommand } from "./command-runner-map.js";
import { findMatchingSessions } from "./session-store.js";
import { getCurrentBranch, getPendingChanges } from "./vcs/index.js";
import { buildIntentContext, classifyIntentHeuristic } from "./intent-classifier.js";
import { planFromClassifier, planFromNlpPrimary, type OmniExecutionStep } from "./execution-planner.js";
import { translateAndRoute } from "./polyglot-router.js";
import { autoSuggestLearn } from "./context-health.js";
import { isInteractive, renderResumePreview, shouldUseColor } from "./ui/chat-ui.js";

const ARCHITECTURE_SIGNALS = [
  "architecture",
  "architect",
  "design",
  "approach",
  "tradeoff",
  "trade-off",
  "should we",
  " vs ",
  " versus ",
  " or ",
  "decision",
  "constraint",
  "scalability",
  "migration",
  "billing",
  "auth",
  "payment",
  "stripe",
];

/** Heuristic: prefer Socratic workflow for ambiguous / architecture-heavy intents. */
export function shouldUseWorkflowMode(params: { intent: string; hasGitDiff: boolean }): boolean {
  const lower = params.intent.toLowerCase();
  if (ARCHITECTURE_SIGNALS.some((k) => lower.includes(k))) return true;
  if (params.hasGitDiff && params.intent.length > 40) return true;
  if (/\b(we need|we want|i need|thinking|explore|challenge)\b/i.test(params.intent)) return true;
  return false;
}

export type OmniArgvOpts = {
  forceResonate?: boolean;
  forceRoutine?: boolean;
};

/** Strip leading global flags before the natural-language query. */
export function parseOmniArgv(argv: string[]): OmniArgvOpts & { query: string } {
  let forceResonate = false;
  let forceRoutine = false;
  const rest: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--force-resonate") {
      forceResonate = true;
      i++;
      continue;
    }
    if (a === "--force-routine") {
      forceRoutine = true;
      i++;
      continue;
    }
    if (a === "--") {
      rest.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("-")) {
      i++;
      continue;
    }
    rest.push(...argv.slice(i));
    break;
  }
  return {
    query: rest.join(" ").trim(),
    ...(forceResonate ? { forceResonate: true } : {}),
    ...(forceRoutine ? { forceRoutine: true } : {}),
  };
}

const ROUTER_STEPS = new Set<OmniExecutionStep>([
  "sync",
  "learn",
  "validate",
  "fix",
  "prompt",
  "routine",
  "resonate",
  "trace",
  "watch",
]);

function filterRouterSteps(commands: string[]): OmniExecutionStep[] {
  const out: OmniExecutionStep[] = [];
  for (const c of commands) {
    const x = c.toLowerCase() as OmniExecutionStep;
    if (ROUTER_STEPS.has(x)) out.push(x);
  }
  return out;
}

/**
 * Omnirouter — `pi "<natural language>"` without an explicit subcommand.
 * Multilingual NLP plan + git-aware heuristics + optional multi-step chain (e.g. validate → fix).
 */
export async function runOmniRouter(
  cwd: string,
  query: string,
  opts: OmniArgvOpts & { nonInteractive?: boolean } = {}
): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) {
    console.error(chalk.red('Usage: pi "<natural language>"'));
    console.log(chalk.dim("\nExamples:"));
    console.log(chalk.cyan('  pi "add billing with Stripe"'));
    console.log(chalk.cyan('  pi "refactor auth to use middleware"'));
    console.log(chalk.cyan('  pi "should we use Redis or in-memory cache?"'));
    process.exitCode = 1;
    return;
  }

  const useAnimated = !opts.nonInteractive && isInteractive() && shouldUseColor();
  const routerSpinner = useAnimated ? clack.spinner() : null;
  if (routerSpinner) {
    routerSpinner.start("Pi is analyzing your request");
  } else if (!opts.nonInteractive) {
    console.log(chalk.dim("💬 Pi is analyzing your request..."));
  }

  // Proactive context health check
  await autoSuggestLearn(cwd, { interactive: !opts.nonInteractive });

  const branch = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const changed = await getPendingChanges(cwd);
  const hasGitDiff = changed.length > 0;
  if (routerSpinner) {
    routerSpinner.stop(chalk.dim("Routed."));
  }

  if (opts.forceRoutine) {
    const poly = await translateAndRoute(cwd, trimmed);
    if (poly.plan.routing.warnings?.length) {
      for (const w of poly.plan.routing.warnings) console.log(chalk.yellow(`⚠ ${w}`));
    }
    console.log(chalk.dim("◒ Routing to ") + chalk.cyan("pi routine") + chalk.dim(" (--force-routine)"));
    await executeCommand("routine", { cwd, intent: poly.normalizedIntent, fromOmniRouter: true });
    return;
  }

  if (opts.forceResonate) {
    const poly = await translateAndRoute(cwd, trimmed);
    if (poly.plan.routing.warnings?.length) {
      for (const w of poly.plan.routing.warnings) console.log(chalk.yellow(`⚠ ${w}`));
    }
    const wf = shouldUseWorkflowMode({ intent: poly.normalizedIntent, hasGitDiff });
    console.log(chalk.dim("◒ Routing to ") + chalk.cyan("pi resonate") + chalk.dim(" (--force-resonate)"));
    await runResonate(cwd, poly.originalQuery, { workflow: wf, plan: wf, fromOmniRouter: true });
    return;
  }

  // Resume hint: matching in-flight session
  const matches = findMatchingSessions(cwd, branch, trimmed, {
    minScore: 0.48,
    statuses: ["question", "building"],
  });
  const top = matches[0];
  if (top && top.score >= 0.72 && !opts.nonInteractive) {
    const panel = renderResumePreview({
      score: top.score,
      intentSummary: top.session.intent_summary,
      lastPiMessage: top.session.last_pi_message,
      sessionId: top.session.session_id,
    });
    console.log("");
    console.log(panel);
    const pick = await clack.confirm({
      message: "Continue this session?",
      initialValue: true,
    });
    if (!clack.isCancel(pick) && pick) {
      console.log(chalk.dim("◒ Resuming ") + chalk.cyan("pi resonate") + chalk.dim(" with saved transcript…"));
      await runResonate(cwd, trimmed, {
        resumeSessionId: top.session.session_id,
        workflow: shouldUseWorkflowMode({ intent: top.session.intent_summary, hasGitDiff }),
        plan: shouldUseWorkflowMode({ intent: top.session.intent_summary, hasGitDiff }),
        fromOmniRouter: true,
      });
      return;
    }
  }

  const poly = await translateAndRoute(cwd, trimmed);
  if (poly.plan.routing.warnings?.length) {
    for (const w of poly.plan.routing.warnings) console.log(chalk.yellow(`⚠ ${w}`));
  }

  const cmdNames = poly.plan.routing.commands.map((c) => c.command);
  const filtered = filterRouterSteps(cmdNames);
  const primaryLower = poly.plan.routing.primary?.toLowerCase();
  const primaryStep = ROUTER_STEPS.has(primaryLower as OmniExecutionStep)
    ? (primaryLower as OmniExecutionStep)
    : undefined;

  let stepsList = filtered.length ? filtered : primaryStep ? [primaryStep] : [];
  let planSource: "nlp" | "heuristic" = "nlp";

  if (!stepsList.length) {
    const ctx = await buildIntentContext(cwd, trimmed, poly.normalizedIntent);
    const classified = classifyIntentHeuristic(ctx);
    const plan = planFromClassifier(classified, "heuristic");
    stepsList = plan.steps;
    planSource = "heuristic";
  } else {
    const plan = planFromNlpPrimary(poly.plan.routing.primary, stepsList);
    stepsList = plan.steps;
    planSource = plan.source;
  }

  if (stepsList.length > 1) {
    console.log(chalk.dim(`◐ Execution plan (${planSource}): ${stepsList.join(" → ")}`));
  }

  for (const step of stepsList) {
    if (step === "resonate") {
      const wf = shouldUseWorkflowMode({ intent: poly.normalizedIntent, hasGitDiff });
      console.log(
        chalk.dim("◒ Auto-routing to ") +
          chalk.cyan("pi resonate") +
          chalk.dim(wf ? " (Socratic workflow)" : " (interactive)")
      );
      await runResonate(cwd, poly.originalQuery, { workflow: wf, plan: wf, fromOmniRouter: true });
    } else {
      console.log(chalk.dim("◒ Running ") + chalk.cyan(`pi ${step}`));
      await executeCommand(step, {
        cwd,
        intent: poly.normalizedIntent,
        fromOmniRouter: true,
      });
    }
  }
}
