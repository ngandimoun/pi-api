import { z } from "zod";

import { ALLOWED_RESOLUTIONS, FLASH_ASPECT_RATIOS } from "@/lib/avatar/image-config";

const avatarMetadataSchema = z
  .record(z.string().trim().max(500))
  .refine((value) => Object.keys(value).length <= 16, {
    message: "metadata may contain at most 16 keys.",
  })
  .optional();

/**
 * Optional structured hints for avatar generation (server expands using full taxonomy).
 * Keys are snake_case; values are strings, booleans, or string arrays where applicable.
 */
export const avatarHintsSchema = z
  .object({
    ethnicity: z.string().optional(),
    role_archetype: z.string().optional(),
    age_range: z.string().optional(),
    gender_expression: z.string().optional(),
    custom_gender_expression: z.string().optional(),
    avatar_composition: z.string().optional(),
    pose_style: z.string().optional(),
    camera_view: z.string().optional(),
    eye_direction: z.string().optional(),
    head_orientation: z.string().optional(),
    body_type: z.string().optional(),
    skin_tone: z.string().optional(),
    hair_style: z.string().optional(),
    hair_color: z.string().optional(),
    eye_color: z.string().optional(),
    outfit_category: z.string().optional(),
    art_direction: z.string().optional(),
    visual_influence: z.string().optional(),
    lighting: z.string().optional(),
    background: z.string().optional(),
    mood: z.string().optional(),
    filter_culture: z.string().optional(),
    filter_industry: z.string().optional(),
    accessories: z.array(z.string()).max(32).optional(),
    expression: z.string().optional(),
  })
  .passthrough()
  .optional();

const flashAspectRatioSchema = z.enum(FLASH_ASPECT_RATIOS);

/** Canvas / resolution controls (vendor-neutral). Omit fields for server defaults. */
export const avatarOutputSchema = z.object({
  /** `auto` or omit: derive from `hints` (e.g. avatar_composition). Otherwise a fixed Flash aspect ratio. */
  aspect_ratio: z.union([z.literal("auto"), flashAspectRatioSchema]).optional(),
  /** Image tier: `512`, `1K`, `2K`, `4K` (uppercase K). Default `1K`. */
  resolution: z.enum(ALLOWED_RESOLUTIONS).optional(),
  thinking_intensity: z.enum(["minimal", "high"]).optional(),
});

export type AvatarOutput = z.infer<typeof avatarOutputSchema>;

export const avatarGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  hints: avatarHintsSchema,
  /** Up to six reference images (data URLs or raw base64). If non-empty, library retrieval is skipped. */
  reference_images: z.array(z.string().min(1)).max(6).optional(),
  output: avatarOutputSchema.optional(),
  /** Optional developer-provided correlation id for workflow/agent tracing. */
  client_reference_id: z.string().trim().min(1).max(200).optional(),
  /** Optional developer-provided metadata echoed back via the job payload. */
  metadata: avatarMetadataSchema,
});

export type AvatarGenerationInput = z.infer<typeof avatarGenerationInputSchema>;

export const avatarSaveInputSchema = z.object({
  job_id: z.string().uuid(),
  label: z.string().trim().max(200).optional(),
});

export type AvatarSaveInput = z.infer<typeof avatarSaveInputSchema>;