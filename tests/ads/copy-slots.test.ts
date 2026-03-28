import { describe, expect, it } from "vitest";

import { compileAdPrompt } from "@/lib/ads/prompt-compiler";
import { extractCopySlots } from "@/lib/ads/workers";

describe("dynamic copy slot extraction", () => {
  it("extracts multilingual slots from arbitrary order prompt", () => {
    const slots = extractCopySlots({
      prompt: "drink ads for gen z with the text buy now in arabic and i love this drink in chinese",
    });

    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(slots.some((slot) => slot.language === "ar")).toBe(true);
    expect(slots.some((slot) => slot.language === "zh")).toBe(true);
  });
});

describe("prompt compiler copy slot emission", () => {
  it("emits strict copy slot constraints in compiled prompt", () => {
    const compiled = compileAdPrompt({
      directive_version: "ad_directive_v1",
      request_intent: {
        raw_prompt: "mixed language test",
        inferred_objective: "drive sales",
        product_focus: "drink",
        target_market: "gen z",
      },
      reference_understanding: {
        uploaded_image_count: 0,
        uploaded_summary: "",
        corpus_reference_id: "abc",
        corpus_reference_summary: "sample corpus prompt",
      },
      creative_plan: {
        headline_idea: "headline",
        layout_intent: "layout",
        audience_signal: "gen z",
        cta_strategy: "cta",
        visual_hierarchy: ["hero drink", "cta"],
      },
      copy_slots: [
        {
          slot_type: "headline",
          requested_text_or_intent: "i love this drink",
          language: "zh",
          script: "chinese",
          priority: 1,
          confidence: 0.9,
        },
        {
          slot_type: "cta",
          requested_text_or_intent: "buy now",
          language: "ar",
          script: "arabic",
          priority: 2,
          confidence: 0.9,
        },
      ],
      culture_language_script_plan: {
        language_code: "ar, zh",
        script_notes: "",
        cultural_notes: "",
      },
      human_model_plan: {
        include_human: false,
        representation_notes: "",
      },
      brand_policy_plan: {
        active: false,
        constraints: [],
      },
      generation_config: {
        aspect_ratio: "4:5",
        resolution: "1K",
      },
      quality_targets: {
        min_score: 78,
      },
      diagnostics: {
        steps: [],
      },
    });

    expect(compiled).toContain("Strict copy slots");
    expect(compiled).toContain("HEADLINE | lang=zh");
    expect(compiled).toContain("CTA | lang=ar");
    expect(compiled).toContain("Corpus prompt summary: sample corpus prompt");
  });
});

