import { z } from "zod";

import { campaignAdLocalizationInputSchema } from "@/contracts/campaign-localize-api";

export const campaignDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export const step1LocalizeOutputSchema = z.object({
  source_image: z.object({
    mime_type: z.string().min(1),
    image_base64: z.string().min(1),
  }),
  source_image_analysis: z.object({
    has_human: z.boolean(),
    ocr_text: z.string().default(""),
    layout_description: z.string().min(1),
    subject_description: z.string().min(1),
    product_description: z.string().min(1),
    color_palette: z.string().min(1),
  }),
  brand_context: z
    .object({
      brand_id: z.string().uuid().optional(),
      brand_dna: z.record(z.unknown()).optional(),
    })
    .default({}),
});

export const step2LocalizeOutputSchema = z.object({
  localization_brief: z.object({
    target_culture: z.string().min(1),
    target_language: z.string().min(1),
    target_currency: z.string().min(1),
    layout_preservation_instructions: z.string().min(1),
    cultural_adaptations: z.array(z.string().min(1)).default([]),
    text_translations: z.array(z.string().min(1)).default([]),
    retrieval_query: z.string().min(1),
    keywords: z.array(z.string().min(1)).max(24).default([]),
  }),
});

export const step3LocalizeOutputSchema = z.object({
  corpus_row_id: z.string().min(1),
  corpus_master_prompt: z.string().min(1),
  corpus_image_url: z.string().url(),
  corpus_mime_type: z.string().min(1),
  corpus_image_base64: z.string().min(1),
  corpus_metadata: z.record(z.unknown()).default({}),
  corpus_similarity_score: z.number(),
  retrieval_diagnostics: z.record(z.unknown()).default({}),
});

export const step4LocalizeOutputSchema = z.object({
  structural_layout_map: z.string().min(1),
  keep: z.array(z.string().min(1)).default([]),
  remove: z.array(z.string().min(1)).default([]),
  add: z.array(z.string().min(1)).default([]),
  cultural_replacements: z.array(z.string().min(1)).default([]),
  composition_plan: z.string().min(1),
  style_notes: z.string().min(1),
  currency_format_notes: z.string().min(1).default(""),
  text_direction: z.string().min(1).default("LTR"),
});

export const step5LocalizeOutputSchema = z.object({
  json_prompt: z.record(z.unknown()),
  compiled_text_prompt: z.string().min(1),
});

export const step6LocalizeOutputSchema = z.object({
  result_url: z.string().url(),
  preview_url: z.string().url(),
  image_size_bytes: z.number().int().positive(),
  generation_model: z.string().min(1),
});

export const campaignLocalizeWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: campaignAdLocalizationInputSchema,
});

export const campaignLocalizeWorkflowOutputSchema = z.object({
  result_url: z.string().url(),
  preview_url: z.string().url(),
  image_size_bytes: z.number().int().positive(),
  generation_model: z.string().min(1),
  diagnostics: z.array(campaignDiagnosticsStepSchema).default([]),
});

