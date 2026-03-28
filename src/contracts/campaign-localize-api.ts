import { z } from "zod";

import { campaignAdOutputSchema } from "@/contracts/campaign-ads-api";

const campaignMetadataSchema = z
  .record(z.string().trim().max(500))
  .refine((value) => Object.keys(value).length <= 16, {
    message: "metadata may contain at most 16 keys.",
  })
  .optional();

/**
 * Cultural ad localization request.
 * The developer must provide exactly one source ad image to localize.
 */
export const campaignAdLocalizationInputSchema = z.object({
  /**
   * Optional extra direction (e.g. “keep the CTA, swap culture to Kigali cafe”).
   * The source image remains the canonical composition anchor.
   */
  prompt: z.string().trim().min(1).max(5000),

  /**
   * The ad to localize (exactly one).
   * Accepts: https URL, base64, or data URL.
   */
  source_image_url: z.string().trim().min(1).max(20000).optional(),
  source_job_id: z.string().uuid().optional(),

  /** Target culture/vibe for transfer, e.g. "East African, Kigali vibe". */
  target_culture: z.string().trim().min(1).max(200),

  /** Optional target language name/code; inferred if omitted. */
  target_language: z.string().trim().min(1).max(64).optional(),

  /** Optional currency code/symbol, e.g. "RWF"; inferred if omitted. */
  target_currency: z.string().trim().min(1).max(16).optional(),

  /** Optional brand id (loads brand DNA and brand colors). */
  brand_id: z.string().uuid().optional(),

  /** Optional extra references (style/characters). Max 5; source image is separate. */
  reference_images: z.array(z.string().min(1)).max(5).optional(),

  /** Optional output configuration (aspect ratio, resolution, thinking intensity). */
  output: campaignAdOutputSchema.optional(),

  /** Optional developer-provided correlation id. */
  client_reference_id: z.string().trim().min(1).max(200).optional(),

  /** Optional tracing metadata echoed in the job payload. */
  metadata: campaignMetadataSchema,
}).superRefine((value, ctx) => {
  const hasSourceImageUrl = Boolean(value.source_image_url);
  const hasSourceJobId = Boolean(value.source_job_id);
  if (hasSourceImageUrl === hasSourceJobId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide exactly one of source_image_url or source_job_id.",
      path: ["source_image_url"],
    });
  }
});

export type CampaignAdLocalizationInput = z.infer<typeof campaignAdLocalizationInputSchema>;

