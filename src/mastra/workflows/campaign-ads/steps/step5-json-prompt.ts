import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getCampaignGeminiClient, getCampaignOrchestratorModelId } from "@/lib/campaigns/gemini-client";
import { step5OutputSchema } from "@/mastra/workflows/campaign-ads/schemas";

const EXACT_CAMPAIGN_JSON_TEMPLATE = `{
  "campaign_prompt_generator": {
    "system_instructions": "You are an expert AI prompt engineer, global advertising strategist, and performance marketing psychologist. Fill out this JSON structure dynamically based on the [BRAND_NAME], [CAMPAIGN_GOAL],[TARGET_AUDIENCE/CULTURE], and [PROVIDED_REFERENCES]. You must seamlessly handle mixed languages, strictly adapt the visual aesthetic to the target culture, and inject high-converting marketing psychology (e.g., FOMO, urgency, CTA placement) only where appropriate for the campaign type. Output only the completed JSON.",
    "meta_data": {
      "tool": "[nano_banana_2]",
      "task_type": "[DYNAMIC: e.g., high_end_editorial_triptych, commercial_product_podium, performance_marketing_ad]",
      "aesthetic_direction": "[DYNAMIC: inferred from brand name, goal, and target culture]",
      "primary_prompt_language": "English"
    },
    "marketing_strategy": {
      "campaign_objective": "[DYNAMIC: e.g., brand_awareness, direct_response, flash_sale, product_launch]",
      "target_emotion": "[DYNAMIC: e.g., exclusivity, urgency, trust, nostalgia, aspiration]",
      "value_proposition": "[DYNAMIC]",
      "psychological_triggers": {
        "fomo_element": { "is_active": "[BOOLEAN]", "strategy": "[DYNAMIC]" },
        "urgency_indicator": { "is_active": "[BOOLEAN]", "strategy": "[DYNAMIC]" },
        "social_proof": { "is_active": "[BOOLEAN]", "strategy": "[DYNAMIC]" }
      },
      "call_to_action_planning": {
        "cta_required": "[BOOLEAN]",
        "cta_intent": "[DYNAMIC]",
        "visual_execution": "[DYNAMIC]"
      }
    },
    "reference_assets": {
      "instruction": "Integrate these assets into the generation process if provided in the user's prompt.",
      "image_references": "[ARRAY OF URLs]",
      "style_references": "[ARRAY OF URLs]",
      "character_references": "[ARRAY OF URLs]"
    },
    "cultural_context": {
      "target_culture": "[DYNAMIC]",
      "visual_nuances": "[DYNAMIC]",
      "modesty_and_etiquette": "[DYNAMIC]",
      "text_direction": "[DYNAMIC]"
    },
    "brand_identity": {
      "brand_name": "[BRAND_NAME]",
      "brand_interpretation": "[DYNAMIC]",
      "color_system": {
        "background_atmosphere": "[DYNAMIC]",
        "accent_color": "[DYNAMIC]",
        "natural_tones": "[DYNAMIC]"
      }
    },
    "layout_and_composition": {
      "aspect_ratio": "[DYNAMIC]",
      "grid_structure": "[DYNAMIC]",
      "layout_rules": "Elements must feel visually connected and guide the eye toward the CTA. If RTL (Arabic), primary visual weight and CTA must shift to accommodate reading patterns."
    },
    "visual_sections": [],
    "typography_and_design_language": { "overall_style": "[DYNAMIC]", "graphic_elements": "[DYNAMIC]", "text_overlays": [] },
    "cinematography_and_realism": { "camera_setup": {}, "lighting": {}, "texture_and_materials": {} },
    "quality_control": { "mandatory_inclusions": [], "negative_prompt": [] }
  }
}`;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "not_specified"): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function asBooleanString(value: unknown): string {
  return typeof value === "boolean" ? (value ? "true" : "false") : "not_specified";
}

function deterministicCompiledTextPrompt(
  campaignPromptGenerator: Record<string, unknown>,
  fallbackPrompt: string
): string {
  const meta = asRecord(campaignPromptGenerator.meta_data);
  const strategy = asRecord(campaignPromptGenerator.marketing_strategy);
  const cta = asRecord(strategy.call_to_action_planning);
  const cultural = asRecord(campaignPromptGenerator.cultural_context);
  const brand = asRecord(campaignPromptGenerator.brand_identity);
  const colors = asRecord(brand.color_system);
  const layout = asRecord(campaignPromptGenerator.layout_and_composition);
  const typeLang = asRecord(campaignPromptGenerator.typography_and_design_language);
  const cinema = asRecord(campaignPromptGenerator.cinematography_and_realism);
  const camera = asRecord(cinema.camera_setup);
  const lighting = asRecord(cinema.lighting);
  const qc = asRecord(campaignPromptGenerator.quality_control);

  const lines = [
    "Generate one high-end static marketing ad image.",
    `Brand: ${asString(brand.brand_name, "unknown_brand")}.`,
    `Brand vibe: ${asString(brand.brand_interpretation, "premium editorial")}.`,
    `Campaign goal: ${asString(strategy.campaign_objective, "brand_awareness")}.`,
    `Target emotion: ${asString(strategy.target_emotion, "aspiration")}.`,
    `Value proposition: ${asString(strategy.value_proposition, "clear product benefit")}.`,
    `Target culture: ${asString(cultural.target_culture, "global")}.`,
    `Cultural nuances: ${asString(cultural.visual_nuances, "culture-aware styling")}.`,
    `Etiquette constraints: ${asString(cultural.modesty_and_etiquette, "none")}.`,
    `Text direction: ${asString(cultural.text_direction, "LTR")}.`,
    `Aspect ratio: ${asString(layout.aspect_ratio, "1:1")}.`,
    `Grid structure: ${asString(layout.grid_structure, "single_focal_center")}.`,
    `Layout rules: ${asString(layout.layout_rules, "guide eye toward CTA")}.`,
    `Background atmosphere: ${asString(colors.background_atmosphere, "neutral")}.`,
    `Accent color: ${asString(colors.accent_color, "brand accent")}.`,
    `Natural tones: ${asString(colors.natural_tones, "realistic skin/material tones")}.`,
    `Typography style: ${asString(typeLang.overall_style, "high-legibility modern editorial")}.`,
    `Graphic elements: ${asString(typeLang.graphic_elements, "minimal geometric supports")}.`,
    `CTA required: ${asBooleanString(cta.cta_required)}.`,
    `CTA intent: ${asString(cta.cta_intent, "soft_nudge")}.`,
    `CTA execution: ${asString(cta.visual_execution, "high-contrast and clearly readable")}.`,
    `Camera lens: ${asString(camera.lens, "50mm")}.`,
    `Camera angle: ${asString(camera.angle, "eye-level")}.`,
    `Depth of field: ${asString(camera.depth_of_field, "subject sharp, contextual bokeh")}.`,
    `Lighting style: ${asString(lighting.style, "cinematic studio lighting")}.`,
    `Lighting details: ${asString(lighting.details, "clean highlights and realistic shadows")}.`,
    `Task type: ${asString(meta.task_type, "performance_marketing_ad")}.`,
    `Aesthetic direction: ${asString(meta.aesthetic_direction, "premium commercial editorial")}.`,
    `Mandatory inclusions: ${JSON.stringify(Array.isArray(qc.mandatory_inclusions) ? qc.mandatory_inclusions : [])}.`,
    `Negative prompt terms: ${JSON.stringify(Array.isArray(qc.negative_prompt) ? qc.negative_prompt : [])}.`,
    `Original developer prompt: ${fallbackPrompt}`,
  ];

  return lines.join("\n");
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed) as Record<string, unknown>;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }
  throw new Error("No JSON object found in model output.");
}

export const step5JsonPrompt = createStep({
  id: "campaign-step5-json-prompt",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const ai = getCampaignGeminiClient();
    const model = getCampaignOrchestratorModelId();

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          text: [
            "Return ONLY one JSON object.",
            "You MUST use the EXACT JSON template shape below.",
            "Keep the top-level key exactly: campaign_prompt_generator.",
            "DO NOT include compiled_text_prompt. Only return campaign_prompt_generator object inside the top-level JSON.",
            "Preserve key names and nesting from the template; replace placeholder values dynamically from the provided context.",
            "Do not add markdown, comments, or code fences.",
            `EXACT_TEMPLATE_JSON:\n${EXACT_CAMPAIGN_JSON_TEMPLATE}`,
            `DEV_PROMPT: ${inputData.input.prompt}`,
            `PROMPT_ANALYSIS: ${JSON.stringify(inputData.step1.prompt_analysis)}`,
            `SUMMARY: ${inputData.step2.summary}`,
            `TARGET_AUDIENCE: ${inputData.step2.target_audience}`,
            `REASONING: ${JSON.stringify(inputData.step4)}`,
            `CORPUS_REFERENCE_URL: ${inputData.step3.corpus_image_url}`,
            `CORPUS_REFERENCE_PROMPT: ${inputData.step3.corpus_master_prompt}`,
            "Fill placeholders with campaign-specific values and ensure cultural resonance.",
          ].join("\n"),
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    const parsed = parseJsonObject(text);
    const normalized = z
      .object({
        campaign_prompt_generator: z.record(z.unknown()),
      })
      .parse(parsed);

    const compiledTextPrompt = deterministicCompiledTextPrompt(
      normalized.campaign_prompt_generator,
      inputData.input.prompt
    );

    const step5 = step5OutputSchema.parse({
      json_prompt: normalized.campaign_prompt_generator,
      compiled_text_prompt: compiledTextPrompt,
    });
    return { ...inputData, step5 };
  },
});
