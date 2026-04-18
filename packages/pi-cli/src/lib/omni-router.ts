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
import { hasSeenOmniRouter, markOmniRouterSeen } from "./cli-activity.js";

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
  let confidence = poly.plan.routing.confidence;

  if (!stepsList.length) {
    // Locale-aware fallback: skip heuristic for non-English when offline
    const locale = poly.language || "en";
    const isEnglish = locale.toLowerCase().startsWith("en") || locale === "und";
    
    if (!isEnglish && poly.plan.routing.confidence === 0) {
      // Non-English query with offline NLP - warn and default to prompt
      console.log(chalk.yellow("⚠ Natural language routing not available for non-English queries offline."));
      console.log(chalk.dim("  Try: pi resonate \"<your intent>\" or pi prompt \"<your intent>\""));
      stepsList = ["prompt"];
      planSource = "heuristic";
      confidence = 0.3;
    } else {
      const ctx = await buildIntentContext(cwd, trimmed, poly.normalizedIntent);
      const classified = classifyIntentHeuristic(ctx);
      const plan = planFromClassifier(classified, "heuristic");
      stepsList = plan.steps;
      planSource = "heuristic";
      confidence = plan.confidence;
    }
  } else {
    const plan = planFromNlpPrimary(poly.plan.routing.primary, stepsList, poly.plan.routing.confidence);
    stepsList = plan.steps;
    planSource = plan.source;
    confidence = plan.confidence;
  }

  // Confidence gate: ask for confirmation if confidence is low
  if (confidence < 0.6 && isInteractive() && !opts.forceResonate && !opts.forceRoutine) {
    const yesFlag =
      process.env.PI_CLI_YES === "1" ||
      process.argv.includes("--yes") ||
      process.argv.includes("-y");
    if (!yesFlag) {
      console.log(chalk.yellow(`\n⚠ Low confidence (${(confidence * 100).toFixed(0)}%) in intent interpretation.`));
      console.log(chalk.dim(`   Query: "${trimmed}"`));
      console.log(chalk.dim(`   Proposed: ${stepsList.join(" → ")}\n`));
      
      const alternatives: { value: string; label: string }[] = [
        { value: "proceed", label: `Proceed with ${stepsList.join(" → ")}` },
        { value: "resonate", label: "Ask Pi to clarify (resonate)" },
        { value: "prompt", label: "Generate a prompt for another agent" },
        { value: "abort", label: "Cancel" },
      ];
      
      const choice = await clack.select({
        message: "How would you like to proceed?",
        options: alternatives,
      });
      
      if (clack.isCancel(choice) || choice === "abort") {
        console.log(chalk.dim("Cancelled."));
        return;
      }
      
      if (choice === "resonate") {
        stepsList = ["resonate"];
      } else if (choice === "prompt") {
        stepsList = ["prompt"];
      }
      // If "proceed", keep stepsList as-is
    }
  }

  if (stepsList.length > 1) {
    console.log(chalk.dim(`◐ Execution plan (${planSource}): ${stepsList.join(" → ")}`));
  }

  // First-run dry-run: show plan and confirm
  const skipFirstRunConfirm = process.env.PI_CLI_SKIP_FIRST_RUN_CONFIRM === "1";
  const seenBefore = await hasSeenOmniRouter(cwd);
  
  if (!seenBefore && !skipFirstRunConfirm && isInteractive() && stepsList.length > 0) {
    console.log(chalk.cyan("\n👋 First time using natural language with Pi!"));
    console.log(chalk.dim("   Pi interpreted your query and will execute:\n"));
    console.log(chalk.white(`   ${stepsList.map(s => `pi ${s}`).join(" → ")}\n`));
    console.log(chalk.dim("   You can skip this confirmation in the future by setting:"));
    console.log(chalk.dim("   PI_CLI_SKIP_FIRST_RUN_CONFIRM=1\n"));
    
    const proceed = await clack.confirm({
      message: "Execute this plan?",
      initialValue: true,
    });
    
    if (clack.isCancel(proceed) || !proceed) {
      console.log(chalk.dim("Cancelled. You can try:"));
      console.log(chalk.dim(`  • pi resonate "${trimmed}" - interactive architecture discussion`));
      console.log(chalk.dim(`  • pi routine "${trimmed}" - generate implementation spec`));
      console.log(chalk.dim(`  • pi prompt "${trimmed}" - create prompt for another agent`));
      return;
    }
    
    await markOmniRouterSeen(cwd);
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
