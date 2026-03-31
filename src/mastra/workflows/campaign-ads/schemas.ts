import { z } from "zod";

import { campaignAdGenerationInputSchema } from "../../../contracts/campaign-ads-api";

export const campaignDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export const step1OutputSchema = z.object({
  prompt_analysis: z.object({
    inferred_objective: z.string().min(1),
    product_focus: z.string().min(1),
    target_market: z.string().min(1),
    language_code: z.string().min(2),
    include_human: z.boolean(),
  }),
  image_analyses: z.array(z.string().min(1)).default([]),
  combined_intent: z.string().min(1),
  brand_constraints: z.array(z.string().min(1)).default([]),
  brand_projection: z.record(z.unknown()).nullable().default(null),
});

export const step2OutputSchema = z.object({
  summary: z.string().min(1),
  keywords: z.array(z.string().min(1)).max(20).default([]),
  style_direction: z.string().min(1),
  target_audience: z.string().min(1),
});

export const step3OutputSchema = z.object({
  corpus_row_id: z.string().min(1),
  corpus_master_prompt: z.string().min(1),
  corpus_image_url: z.string().url(),
  corpus_mime_type: z.string().min(1),
  corpus_image_base64: z.string().min(1),
  corpus_metadata: z.record(z.unknown()).default({}),
  corpus_similarity_score: z.number(),
});

export const step4OutputSchema = z.object({
  keep: z.array(z.string().min(1)).default([]),
  remove: z.array(z.string().min(1)).default([]),
  add: z.array(z.string().min(1)).default([]),
  composition_plan: z.string().min(1),
  style_notes: z.string().min(1),
});

export const step5OutputSchema = z.object({
  json_prompt: z.record(z.unknown()),
  compiled_text_prompt: z.string().min(1),
});

export const step6OutputSchema = z.object({
  result_url: z.string().url(),
  preview_url: z.string().url(),
  image_size_bytes: z.number().int().positive(),
  generation_model: z.string().min(1),
});

export const campaignWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: campaignAdGenerationInputSchema,
});

export const campaignWorkflowOutputSchema = z.object({
  result_url: z.string().url(),
  preview_url: z.string().url(),
  image_size_bytes: z.number().int().positive(),
  generation_model: z.string().min(1),
  diagnostics: z.array(campaignDiagnosticsStepSchema).default([]),
});
