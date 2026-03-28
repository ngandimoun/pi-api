import type { AdDirectiveV1 } from "@/contracts/ads-api";
import { adDirectiveSchema, type AdGenerationInput } from "@/contracts/ads-api";
import type { AdCorpusReference } from "@/lib/ads/retrieve-reference";

export function buildInitialDirective(params: {
  input: AdGenerationInput;
  inferredObjective: string;
  productFocus: string;
  targetMarket: string;
  languageCode: string;
  includeHuman: boolean;
  copySlots: AdDirectiveV1["copy_slots"];
  uploadedSummary: string;
  corpusReference: AdCorpusReference | null;
  creativePlan: AdDirectiveV1["creative_plan"];
  scriptNotes: string;
  culturalNotes: string;
  brandConstraints: string[];
  brandActive: boolean;
}): AdDirectiveV1 {
  return adDirectiveSchema.parse({
    directive_version: "ad_directive_v1",
    request_intent: {
      raw_prompt: params.input.prompt,
      inferred_objective: params.inferredObjective,
      product_focus: params.productFocus,
      target_market: params.targetMarket,
    },
    reference_understanding: {
      uploaded_image_count: params.input.reference_images?.length ?? 0,
      uploaded_summary: params.uploadedSummary,
      corpus_reference_id: params.corpusReference?.row.id ?? null,
      corpus_reference_summary: params.corpusReference?.row.master_prompt ?? "",
    },
    creative_plan: params.creativePlan,
    copy_slots: params.copySlots,
    culture_language_script_plan: {
      language_code: params.languageCode,
      script_notes: params.scriptNotes,
      cultural_notes: params.culturalNotes,
    },
    human_model_plan: {
      include_human: params.includeHuman,
      representation_notes: "",
    },
    brand_policy_plan: {
      active: params.brandActive,
      constraints: params.brandConstraints,
    },
    generation_config: {
      aspect_ratio: "1:1",
      resolution: "1K",
    },
    quality_targets: {
      min_score: 78,
    },
    diagnostics: {
      steps: [],
    },
  });
}

export function pushDirectiveStep(
  directive: AdDirectiveV1,
  step: AdDirectiveV1["diagnostics"]["steps"][number]
) {
  directive.diagnostics.steps.push(step);
}

