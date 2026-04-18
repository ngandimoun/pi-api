import chalk from "chalk";
import { shouldUseColor } from "./ui/chat-ui.js";

export type ThinkingPhase =
  | "analyzing-intent"
  | "loading-context"
  | "querying-graph"
  | "reading-codebase"
  | "checking-patterns"
  | "evaluating-tradeoffs"
  | "generating-plan"
  | "validating-approach";

export type StatusDisplayMode = "minimal" | "rich" | "verbose";

const PHASE_LABELS: Record<ThinkingPhase, string> = {
  "analyzing-intent": "🧠 Analyzing your request",
  "loading-context": "📚 Loading codebase context",
  "querying-graph": "🔍 Querying dependency graph",
  "reading-codebase": "📖 Reading relevant files",
  "checking-patterns": "🔎 Checking existing patterns",
  "evaluating-tradeoffs": "⚖️  Evaluating tradeoffs",
  "generating-plan": "📝 Generating plan",
  "validating-approach": "✅ Validating approach",
};

const PHASE_HINTS: Record<ThinkingPhase, string> = {
  "analyzing-intent": "Understanding what you want to build...",
  "loading-context": "Pulling system style, memory, and repo metadata...",
  "querying-graph": "Checking import graph for blast radius...",
  "reading-codebase": "Scanning files to understand current architecture...",
  "checking-patterns": "Comparing your idea against existing conventions...",
  "evaluating-tradeoffs": "Weighing different approaches and their implications...",
  "generating-plan": "Structuring the implementation blueprint...",
  "validating-approach": "Running safety checks and constraint validation...",
};

/** Ordered cycle used by `tick()` when the caller doesn't override the phase. */
const DEFAULT_PHASE_CYCLE: ThinkingPhase[] = [
  "analyzing-intent",
  "loading-context",
  "querying-graph",
  "checking-patterns",
  "evaluating-tradeoffs",
  "generating-plan",
];

export class RichStatusDisplay {
  private mode: StatusDisplayMode;
  private currentPhase?: ThinkingPhase;
  private startTime: number;
  private phaseStartTime: number;
  private phaseIndex: number = 0;
  private mastraOffline: boolean = false;

  constructor(mode: StatusDisplayMode = "rich") {
    this.mode = mode;
    this.startTime = Date.now();
    this.phaseStartTime = Date.now();
  }

  /** Mark Mastra as offline/unavailable */
  setMastraOffline(offline: boolean): void {
    this.mastraOffline = offline;
  }

  /** Get Mastra availability status badge */
  getMastraBadge(): string {
    if (!this.mastraOffline) return "";
    const label = shouldUseColor() ? chalk.yellow("⚠ Mastra: offline (local-only mode)") : "⚠ Mastra: offline (local-only mode)";
    return `${label}\n`;
  }

  /** Seconds since the current phase began. */
  elapsedMs(): number {
    return Date.now() - this.phaseStartTime;
  }

  /** Total seconds since the display was created. */
  totalElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /** Return the active phase (or a sensible default when nothing is active). */
  getCurrentPhase(): ThinkingPhase {
    return this.currentPhase ?? "analyzing-intent";
  }

  /** Short human label for a phase — used by spinner text. */
  phaseLabel(phase: ThinkingPhase = this.getCurrentPhase()): string {
    return PHASE_LABELS[phase];
  }

  /**
   * Advance to the next phase in the default cycle. Safe to call from a
   * `setInterval` to keep the spinner text feeling alive during long API
   * waits. Returns the new phase label (stripped of emoji when color off).
   */
  tick(): string {
    this.phaseIndex = (this.phaseIndex + 1) % DEFAULT_PHASE_CYCLE.length;
    this.currentPhase = DEFAULT_PHASE_CYCLE[this.phaseIndex];
    this.phaseStartTime = Date.now();
    return this.phaseLabel();
  }

  /**
   * Start a new thinking phase with visual indicator
   */
  startPhase(phase: ThinkingPhase): void {
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();

    if (this.mode === "minimal") {
      process.stdout.write(chalk.dim("."));
      return;
    }

    const label = PHASE_LABELS[phase];
    const hint = PHASE_HINTS[phase];

    console.log("");
    console.log(chalk.bold(label));
    if (this.mode === "rich" || this.mode === "verbose") {
      console.log(chalk.dim(`  ${hint}`));
    }
  }

  /**
   * Log a sub-action within a phase (only in verbose mode)
   */
  logAction(action: string, detail?: string): void {
    if (this.mode !== "verbose") return;

    const elapsed = Date.now() - this.phaseStartTime;
    const prefix = chalk.gray(`  [${(elapsed / 1000).toFixed(1)}s]`);
    console.log(`${prefix} ${chalk.cyan(action)}`);
    if (detail) {
      console.log(chalk.dim(`       ${detail}`));
    }
  }

  /**
   * Complete the current phase
   */
  completePhase(summary?: string): void {
    const elapsed = Date.now() - this.phaseStartTime;

    if (this.mode === "minimal") return;

    if (summary) {
      console.log(chalk.dim(`  ✓ ${summary} ${chalk.gray(`(${(elapsed / 1000).toFixed(1)}s)`)}`));
    } else if (this.mode === "verbose") {
      console.log(chalk.dim(`  ✓ Complete ${chalk.gray(`(${(elapsed / 1000).toFixed(1)}s)`)}`));
    }
  }

  /**
   * Show total elapsed time
   */
  complete(): void {
    const elapsed = Date.now() - this.startTime;
    if (this.mode !== "minimal") {
      console.log("");
      console.log(chalk.dim(`⏱️  Total: ${(elapsed / 1000).toFixed(1)}s`));
    }
  }
}

/**
 * Create a status display based on environment / flags
 */
export function createStatusDisplay(opts?: { verbose?: boolean; quiet?: boolean }): RichStatusDisplay {
  let mode: StatusDisplayMode = "rich";

  if (opts?.quiet) {
    mode = "minimal";
  } else if (opts?.verbose) {
    mode = "verbose";
  } else if (!shouldUseColor() || !process.stdout.isTTY) {
    mode = "minimal";
  }

  return new RichStatusDisplay(mode);
}

/**
 * Render claims traceability evidence from Pi agents.
 * Shows which claims were made and their sources (files, tools, memory).
 */
export function renderClaimsTraceability(
  claims: Array<{ claim: string; source: string; tool?: string }>
): void {
  if (!claims || claims.length === 0) return;

  console.log("");
  console.log(chalk.bold.cyan("Evidence & Claims Traceability"));
  console.log(chalk.dim("(sources used by Pi to ground architectural analysis)\n"));

  for (const c of claims) {
    const toolBadge = c.tool ? chalk.dim(` [via ${c.tool}]`) : "";
    console.log(chalk.white(`  • ${c.claim}`));
    console.log(chalk.dim(`    Source: ${c.source}${toolBadge}`));
  }
  
  console.log("");
}
