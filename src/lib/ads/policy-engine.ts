import type { AdDirectiveV1 } from "../../contracts/ads-api";

const LATIN_SCRIPT_LANGS = new Set([
  "en",
  "fr",
  "es",
  "pt",
  "de",
  "it",
  "vi",
  "id",
  "sw",
]);

function normalizeLanguageCode(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (!lower) return "en";
  const base = lower.split("-")[0];
  return base || "en";
}

/**
 * Deterministic policy layer for directives.
 * LLM suggestions are accepted only after this pass.
 */
export function enforceDirectivePolicies(directive: AdDirectiveV1): AdDirectiveV1 {
  const next = structuredClone(directive);
  const lang = normalizeLanguageCode(next.culture_language_script_plan.language_code);
  next.culture_language_script_plan.language_code = lang;

  if (LATIN_SCRIPT_LANGS.has(lang)) {
    if (!next.culture_language_script_plan.script_notes) {
      next.culture_language_script_plan.script_notes =
        "Use consistent Latin script; avoid mixed scripts unless explicitly requested.";
    }
  }

  // Policy: brand constraints override ambiguous creative choices.
  if (next.brand_policy_plan.active && next.brand_policy_plan.constraints.length > 0) {
    const hasLogoBan = next.brand_policy_plan.constraints.some((item) =>
      item.toLowerCase().includes("no_logo")
    );
    if (hasLogoBan) {
      next.creative_plan.visual_hierarchy = next.creative_plan.visual_hierarchy.filter(
        (item) => !item.toLowerCase().includes("logo")
      );
    }
  }

  // Policy: ensure product prominence always appears in hierarchy.
  if (
    !next.creative_plan.visual_hierarchy.some((item) =>
      item.toLowerCase().includes("product")
    )
  ) {
    next.creative_plan.visual_hierarchy.unshift("Product is the primary visual anchor");
  }

  return next;
}

