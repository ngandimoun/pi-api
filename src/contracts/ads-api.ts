import { z } from "zod";

import { ALLOWED_RESOLUTIONS, FLASH_ASPECT_RATIOS } from "../lib/avatar/image-config";

export const adFailureCodeSchema = z.enum([
  "retrieval_failed",
  "policy_conflict",
  "language_unresolved",
  "creative_plan_invalid",
  "directive_validation_failed",
  "quality_gate_failed",
  "generation_blocked",
  "generation_empty",
  "reference_input_invalid",
  "budget_exceeded",
  "internal_step_failed",
]);

export const adStepStatusSchema = z.enum(["ok", "retryable_error", "fatal_error"]);

export const adStepArtifactSchema = z.object({
  step_id: z.string().min(1),
  status: adStepStatusSchema,
  confidence: z.number().min(0).max(1).optional(),
  artifacts: z.record(z.unknown()).default({}),
  failure_code: adFailureCodeSchema.optional(),
  recovery_hint: z.string().min(1).optional(),
});

export const adDirectiveCreativePlanSchema = z.object({
  headline_idea: z.string().min(1),
  layout_intent: z.string().min(1),
  audience_signal: z.string().min(1),
  cta_strategy: z.string().min(1),
  visual_hierarchy: z.array(z.string().min(1)).min(2).max(8),
});

export const adCopySlotSchema = z.object({
  slot_type: z.enum(["headline", "cta", "subcopy", "badge"]),
  requested_text_or_intent: z.string().min(1),
  language: z.string().min(2),
  script: z.string().min(1).default("auto"),
  priority: z.number().int().min(1).max(8).default(1),
  source_fragment: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

export const adDirectiveSchema = z.object({
  directive_version: z.literal("ad_directive_v1"),
  request_intent: z.object({
    raw_prompt: z.string().min(1),
    inferred_objective: z.string().min(1),
    product_focus: z.string().min(1),
    target_market: z.string().min(1).default("global"),
  }),
  reference_understanding: z.object({
    uploaded_image_count: z.number().int().min(0).max(6),
    uploaded_summary: z.string().default(""),
    corpus_reference_id: z.string().nullable().default(null),
    corpus_reference_summary: z.string().default(""),
  }),
  creative_plan: adDirectiveCreativePlanSchema,
  copy_slots: z.array(adCopySlotSchema).default([]),
  culture_language_script_plan: z.object({
    language_code: z.string().min(2),
    script_notes: z.string().default(""),
    cultural_notes: z.string().default(""),
  }),
  human_model_plan: z.object({
    include_human: z.boolean(),
    representation_notes: z.string().default(""),
  }),
  brand_policy_plan: z.object({
    active: z.boolean().default(false),
    constraints: z.array(z.string()).default([]),
  }),
  generation_config: z.object({
    aspect_ratio: z.enum(FLASH_ASPECT_RATIOS).default("1:1"),
    resolution: z.enum(ALLOWED_RESOLUTIONS).default("1K"),
    thinking_intensity: z.enum(["minimal", "high"]).optional(),
  }),
  quality_targets: z.object({
    min_score: z.number().min(0).max(100).default(78),
  }),
  diagnostics: z.object({
    steps: z.array(adStepArtifactSchema).default([]),
  }),
});

export type AdDirectiveV1 = z.infer<typeof adDirectiveSchema>;

const adMetadataSchema = z
  .record(z.string().trim().max(500))
  .refine((value) => Object.keys(value).length <= 16, {
    message: "metadata may contain at most 16 keys.",
  })
  .optional();

export const adOutputSchema = z.object({
  aspect_ratio: z.union([z.literal("auto"), z.enum(FLASH_ASPECT_RATIOS)]).optional(),
  resolution: z.enum(ALLOWED_RESOLUTIONS).optional(),
  thinking_intensity: z.enum(["minimal", "high"]).optional(),
});

export const adGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1).max(5000),
  reference_images: z.array(z.string().min(1)).max(6).optional(),
  brand_id: z.string().uuid().optional(),
  brand_identity_json: z.record(z.unknown()).optional(),
  output: adOutputSchema.optional(),
  client_reference_id: z.string().trim().min(1).max(200).optional(),
  metadata: adMetadataSchema,
});

export type AdGenerationInput = z.infer<typeof adGenerationInputSchema>;

