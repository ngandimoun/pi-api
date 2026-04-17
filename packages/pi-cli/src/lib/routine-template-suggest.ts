import type { RoutineTemplate } from "pi-routine-spec";

const STRONG_VT =
  /\bview transitions?\b|viewtransition|addtransitiontype|transitiontypes|startviewtransition|::view-transition|shared element transitions?|morph-forward|nav-forward|nav-back|experimental\.viewtransition|view-transition-name/;

/** Narrow perf signals — avoid treating bare "suspense" (used in VT docs) as perf-pack intent. */
const STRONG_PERF =
  /\b(waterfall|sequential await|paralleliz|optimizepackageimports|barrel import|lcp|tti|\brerender\b|\bbundle\b|dynamic import|code split|hydration|react\.cache|optimize\s*package)/;

const VT_PHRASES = ["view transition", "view transitions", "shared element"];

const WEIGHTED_TOKENS: Record<string, number> = {
  viewtransition: 5,
  transitiontypes: 5,
  addtransitiontype: 5,
  startviewtransition: 4,
  viewtransitions: 4,
  navforward: 3,
  navback: 3,
  morph: 2,
};

function tokenizeIntent(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

function haystackFor(t: RoutineTemplate): string {
  const specTags = t.routine_spec?.metadata?.tags ?? [];
  const specIntent = t.routine_spec?.metadata?.intent ?? "";
  return `${t.id} ${t.name} ${t.description} ${t.category} ${t.stack.join(" ")} ${specIntent} ${specTags.join(" ")}`.toLowerCase();
}

function phraseBoost(intentLower: string, id: string): number {
  if (!id.startsWith("react-view-transitions")) return 0;
  let b = 0;
  for (const p of VT_PHRASES) {
    if (intentLower.includes(p)) b += 4;
  }
  return b;
}

/**
 * Scored embedded template suggestions (replaces naive substring-only scoring).
 */
export function scoreEmbeddedTemplates(
  intent: string,
  templates: readonly RoutineTemplate[],
  max = 3
): string[] {
  const intentLower = intent.toLowerCase();
  const tokens = tokenizeIntent(intent);
  if (!tokens.length) return [];

  const scored = templates.map((t) => {
    const hay = haystackFor(t);
    let s = phraseBoost(intentLower, t.id);
    for (const tok of tokens) {
      if (!hay.includes(tok)) continue;
      s += WEIGHTED_TOKENS[tok] ?? 1;
    }
    return { id: t.id, s };
  });

  scored.sort((a, b) => b.s - a.s || a.id.localeCompare(b.id));

  const out: string[] = [];
  for (const x of scored) {
    if (x.s <= 0) continue;
    if (out.length >= max) break;
    out.push(x.id);
  }
  return out;
}

export function hasStrongViewTransitionIntent(intent: string): boolean {
  return STRONG_VT.test(intent.toLowerCase());
}

export function hasStrongPerformanceIntent(intent: string): boolean {
  return STRONG_PERF.test(intent.toLowerCase());
}

/**
 * Collision guard: VT-focused intents should not also pull the perf hub unless
 * narrow perf signals are present (avoids `suspense`/`startTransition` overlap).
 */
export function applyTemplateDominanceRules(ids: Set<string>, intent: string): void {
  if (!ids.has("react-view-transitions-playbook")) return;
  if (!hasStrongViewTransitionIntent(intent)) return;
  if (hasStrongPerformanceIntent(intent)) return;
  ids.delete("react-best-practices-playbook");
}
