import { z } from "zod";

import { ALLOWED_RESOLUTIONS, FLASH_ASPECT_RATIOS } from "@/lib/avatar/image-config";

const campaignMetadataSchema = z
  .record(z.string().trim().max(500))
  .refine((value) => Object.keys(value).length <= 16, {
    message: "metadata may contain at most 16 keys.",
  })
  .optional();

export const campaignAdOutputSchema = z.object({
  aspect_ratio: z.union([z.literal("auto"), z.enum(FLASH_ASPECT_RATIOS)]).optional(),
  resolution: z.enum(ALLOWED_RESOLUTIONS).optional(),
  thinking_intensity: z.enum(["minimal", "high"]).optional(),
});

export const campaignAdGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1).max(5000),
  reference_images: z.array(z.string().min(1)).max(6).optional(),
  brand_id: z.string().uuid().optional(),
  brand_identity_json: z.record(z.unknown()).optional(),
  output: campaignAdOutputSchema.optional(),
  client_reference_id: z.string().trim().min(1).max(200).optional(),
  metadata: campaignMetadataSchema,
});

export type CampaignAdGenerationInput = z.infer<typeof campaignAdGenerationInputSchema>;
