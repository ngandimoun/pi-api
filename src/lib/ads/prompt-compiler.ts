import type { AdDirectiveV1 } from "../../contracts/ads-api";

/**
 * Deterministic final prompt emission from AdDirectiveV1.
 * Acts as a compiler output stage, not free-form orchestration.
 */
export function compileAdPrompt(directive: AdDirectiveV1): string {
  const sortedSlots = [...(directive.copy_slots ?? [])].sort((a, b) => a.priority - b.priority);
  const sections = [
    "1) CREATIVE_OBJECTIVE",
    `- Objective: ${directive.request_intent.inferred_objective}`,
    `- Product focus: ${directive.request_intent.product_focus}`,
    `- Market: ${directive.request_intent.target_market}`,
    "",
    "2) VISUAL_HIERARCHY",
    ...directive.creative_plan.visual_hierarchy.map((item) => `- ${item}`),
    "",
    "3) COMPOSITION_AND_LAYOUT",
    `- Layout intent: ${directive.creative_plan.layout_intent}`,
    `- Human model usage: ${directive.human_model_plan.include_human ? "yes" : "no"}`,
    `- Human representation notes: ${directive.human_model_plan.representation_notes || "none"}`,
    "",
    "4) ON_IMAGE_COPY_POLICY",
    `- Headline concept: ${directive.creative_plan.headline_idea}`,
    `- CTA strategy: ${directive.creative_plan.cta_strategy}`,
    `- Language: ${directive.culture_language_script_plan.language_code}`,
    `- Script notes: ${directive.culture_language_script_plan.script_notes || "none"}`,
    `- Cultural notes: ${directive.culture_language_script_plan.cultural_notes || "none"}`,
    "- Remove any irrelevant copied text from references; generate context-appropriate ad text only.",
    ...(sortedSlots.length > 0
      ? [
          "- Strict copy slots (must preserve slot type + language/script):",
          ...sortedSlots.map(
            (slot) =>
              `- ${slot.slot_type.toUpperCase()} | lang=${slot.language} | script=${slot.script} | intent="${slot.requested_text_or_intent}"`
          ),
        ]
      : []),
    "",
    "5) BRAND_AND_SAFETY_CONSTRAINTS",
    `- Brand constraints active: ${directive.brand_policy_plan.active ? "yes" : "no"}`,
    ...directive.brand_policy_plan.constraints.map((item) => `- ${item}`),
    "- No watermarks, no UI frames, no unrelated logos, no gibberish text.",
    "",
    "6) CORPUS_GROUNDING_REQUIREMENTS",
    `- Corpus reference id: ${directive.reference_understanding.corpus_reference_id ?? "none"}`,
    `- Corpus prompt summary: ${directive.reference_understanding.corpus_reference_summary || "none"}`,
    "- Use corpus image as primary inspiration anchor; preserve product-context consistency.",
    "",
    "7) OUTPUT_REQUIREMENTS",
    "- Single high-quality static ad image.",
    "- Commercially realistic, conversion-oriented, clean composition.",
  ];

  return sections.join("\n").trim();
}

