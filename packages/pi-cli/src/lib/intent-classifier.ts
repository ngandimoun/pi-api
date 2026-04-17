import { getCurrentBranch, getPendingChanges } from "./vcs/index.js";

export type IntentContext = {
  hasGitDiff: boolean;
  changedFileCount: number;
  branch: string;
  query: string;
  normalizedQuery: string;
};

export type ClassifiedIntent = {
  /** Primary verb for omnirouter execution */
  primary: "resonate" | "routine" | "validate" | "fix";
  /** Optional ordered chain (e.g. validate → fix) */
  chain: Array<"resonate" | "routine" | "validate" | "fix">;
  confidence: number;
};

const VALIDATION_HINTS =
  /\b(check|lint|validate|audit|ci|drift|security|review\s+code|code\s+review|pr\s+check)\b/i;
const FIX_HINTS = /\b(fix|autofix|repair|correct|patch)\b/i;
const ROUTINE_HINTS =
  /\b(routine|spec|markdown\s+spec|cursor\s+rules|generate\s+the\s+spec|implementation\s+plan)\b/i;

/** Heuristic routing when NLP is unavailable — git-aware. */
export async function buildIntentContext(cwd: string, query: string, normalizedQuery?: string): Promise<IntentContext> {
  const changed = await getPendingChanges(cwd);
  const branch = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const nq = (normalizedQuery ?? query).trim();
  return {
    hasGitDiff: changed.length > 0,
    changedFileCount: changed.length,
    branch,
    query: query.trim(),
    normalizedQuery: nq.trim() || query.trim(),
  };
}

export function classifyIntentHeuristic(ctx: IntentContext): ClassifiedIntent {
  const q = ctx.normalizedQuery || ctx.query;
  const lower = q.toLowerCase();

  if (FIX_HINTS.test(lower)) {
    if (ctx.hasGitDiff) {
      return { primary: "fix", chain: ["validate", "fix"], confidence: 0.55 };
    }
    return { primary: "validate", chain: ["validate"], confidence: 0.5 };
  }

  if (VALIDATION_HINTS.test(lower) && (ctx.hasGitDiff || q.length < 220)) {
    return { primary: "validate", chain: ["validate"], confidence: 0.62 };
  }

  if (ROUTINE_HINTS.test(lower) && !ctx.hasGitDiff) {
    return { primary: "routine", chain: ["routine"], confidence: 0.58 };
  }

  if (ROUTINE_HINTS.test(lower) && ctx.hasGitDiff) {
    return { primary: "validate", chain: ["validate"], confidence: 0.52 };
  }

  if (ctx.hasGitDiff && q.length < 80 && !/\b(need|want|should|design|architecture)\b/i.test(lower)) {
    return { primary: "validate", chain: ["validate"], confidence: 0.45 };
  }

  if (!ctx.hasGitDiff && q.length > 120 && /\b(build|implement|add|create|refactor)\b/i.test(lower)) {
    return { primary: "routine", chain: ["routine"], confidence: 0.48 };
  }

  return { primary: "resonate", chain: ["resonate"], confidence: 0.4 };
}
