import type { ClassifiedIntent } from "./intent-classifier.js";

export type OmniExecutionStep = "sync" | "learn" | "validate" | "fix" | "prompt" | "routine" | "resonate" | "trace" | "watch";

export type ExecutionPlan = {
  steps: OmniExecutionStep[];
  /** Heuristic or NLP confidence 0–1 */
  confidence: number;
  /** Source of the plan */
  source: "nlp" | "heuristic";
};

function uniqueSteps(chain: OmniExecutionStep[]): OmniExecutionStep[] {
  const out: OmniExecutionStep[] = [];
  const seen = new Set<OmniExecutionStep>();
  for (const s of chain) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Collapse primary + classifier chain into an ordered execution list. */
export function planFromClassifier(classified: ClassifiedIntent, source: "nlp" | "heuristic"): ExecutionPlan {
  const raw = classified.chain.length ? classified.chain : [classified.primary];
  if (classified.primary === "fix" && !raw.includes("validate")) {
    return { steps: uniqueSteps(["validate", "fix"]), confidence: classified.confidence, source };
  }
  return { steps: uniqueSteps(raw), confidence: classified.confidence, source };
}

/** Map NLP primary string to execution steps when server returns a plan. */
export function planFromNlpPrimary(primary: string | undefined, commands: string[]): ExecutionPlan {
  const validCommands = new Set<string>(["sync", "learn", "validate", "fix", "prompt", "routine", "resonate", "trace", "watch"]);
  const normalized = commands
    .map((c) => c.toLowerCase())
    .filter((c) => validCommands.has(c)) as OmniExecutionStep[];

  if (normalized.length) {
    if (normalized.includes("fix") && !normalized.includes("validate")) {
      return { steps: uniqueSteps(["validate", ...normalized]), confidence: 0.65, source: "nlp" };
    }
    return { steps: uniqueSteps(normalized), confidence: 0.65, source: "nlp" };
  }

  const p = primary?.toLowerCase();
  if (p === "sync") return { steps: ["sync"], confidence: 0.6, source: "nlp" };
  if (p === "learn") return { steps: ["learn"], confidence: 0.6, source: "nlp" };
  if (p === "validate") return { steps: ["validate"], confidence: 0.6, source: "nlp" };
  if (p === "routine") return { steps: ["routine"], confidence: 0.6, source: "nlp" };
  if (p === "prompt") return { steps: ["prompt"], confidence: 0.6, source: "nlp" };
  if (p === "fix") return { steps: ["validate", "fix"], confidence: 0.55, source: "nlp" };
  if (p === "trace") return { steps: ["trace"], confidence: 0.6, source: "nlp" };
  if (p === "watch") return { steps: ["watch"], confidence: 0.6, source: "nlp" };
  return { steps: ["resonate"], confidence: 0.5, source: "nlp" };
}
