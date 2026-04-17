import chalk from "chalk";

import { planNaturalLanguage } from "./nlp-router.js";
import { getPendingChanges } from "./vcs/index.js";
import type { PiNlpPlan } from "./api-client.js";

export type PolyglotRouteResult = {
  originalQuery: string;
  language: string;
  languageConfidence: number;
  normalizedIntent: string;
  plan: PiNlpPlan;
};

/**
 * Multilingual NL → Pi NLP plan (language detection + English-normalized intent).
 * Falls back to a thin local envelope when the API is unreachable.
 */
export async function translateAndRoute(cwd: string, query: string): Promise<PolyglotRouteResult> {
  const trimmed = query.trim();
  const changed = (await getPendingChanges(cwd)).slice(0, 200);

  try {
    const plan = await planNaturalLanguage({
      query: trimmed,
      changed_files: changed,
      project_context: {},
    });

    const loc = plan.detected_language;
    if (loc.locale && !loc.locale.toLowerCase().startsWith("en")) {
      console.log(
        chalk.dim(
          `◐ Detected ${loc.locale} (${loc.confidence.toFixed(2)}) — normalized: "${plan.normalized_intent.slice(0, 160)}${plan.normalized_intent.length > 160 ? "…" : ""}"`
        )
      );
    }

    return {
      originalQuery: trimmed,
      language: loc.locale,
      languageConfidence: loc.confidence,
      normalizedIntent: plan.normalized_intent,
      plan,
    };
  } catch {
    return {
      originalQuery: trimmed,
      language: "und",
      languageConfidence: 0,
      normalizedIntent: trimmed,
      plan: {
        detected_language: {
          locale: "en",
          confidence: 0,
          reasoning: "offline-fallback",
        },
        normalized_intent: trimmed,
        routing: {
          primary: "resonate",
          commands: [],
          confidence: 0,
          warnings: ["NLP plan unavailable — using local heuristics."],
        },
      },
    };
  }
}
