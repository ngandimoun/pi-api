import { z } from "zod";

export const jobStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const brandExtractionInputContract = z
  .object({
    url: z.string().url().optional(),
    logoBase64: z.string().min(1).optional(),
    imagesBase64: z.array(z.string().min(1)).optional(),
    location: z
      .object({
        country: z.string().length(2).optional(),
        languages: z.array(z.string().min(2)).optional(),
      })
      .optional(),
  })
  .refine(
    (data) =>
      Boolean(data.url || data.logoBase64 || (data.imagesBase64?.length ?? 0) > 0),
    {
      message: "At least one input is required: url, logoBase64, or imagesBase64.",
      path: ["url"],
    }
  );

export const brandRecordContract = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  domain: z.string(),
  name: z.string(),
  primary_hex: z.string().nullable(),
  secondary_hex: z.string().nullable(),
  logo_url: z.string().nullable(),
  font_file_url: z.string().nullable(),
  layout_rules: z.unknown(),
  brand_dna: z.unknown(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const jobRecordContract = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  type: z.string(),
  status: jobStatusSchema,
  payload: z.unknown(),
  result_url: z.string().nullable(),
  error_log: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  avatar: z
    .object({
      image_url: z.string().url(),
    })
    .optional(),
  ad: z
    .object({
      image_url: z.string().url(),
    })
    .optional(),
  expanded: z
    .object({
      brand: brandRecordContract.optional(),
    })
    .optional(),
  job_result: z
    .object({
      type: z.enum(["brand", "avatar", "ad"]),
      id: z.string().uuid(),
      url: z.string().optional(),
      brand: brandRecordContract.optional(),
      image_url: z.string().url().optional(),
    })
    .optional(),
});

export const successEnvelopeContract = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    id: z.string(),
    object: z.string(),
    status: z.string(),
    created_at: z.number(),
    data: dataSchema,
  });

export const errorEnvelopeContract = z.object({
  error: z.object({
    type: z.enum([
      "invalid_request_error",
      "authentication_error",
      "permission_error",
      "rate_limit_error",
      "api_error",
    ]),
    code: z.string(),
    message: z.string(),
    request_id: z.string(),
  }).passthrough(),
});

export const extractJobQueuedContract = successEnvelopeContract(
  z.object({
    job_id: z.string().uuid(),
  })
);

export const jobRetrieveContract = successEnvelopeContract(jobRecordContract);

export const brandRetrieveContract = successEnvelopeContract(brandRecordContract);

export const brandListContract = successEnvelopeContract(
  z.object({
    data: z.array(brandRecordContract),
    total_count: z.number(),
    has_more: z.boolean(),
  })
);

export const brandProjectionRequestContract = z.object({
  use_case: z.string().trim().min(1),
});

export const brandProjectionResponseContract = successEnvelopeContract(
  z.object({
    use_case: z.string(),
    is_wildcard: z.boolean(),
    payload: z.record(z.unknown()),
  })
);

export type BrandExtractionInputContract = z.infer<typeof brandExtractionInputContract>;
export type JobRecordContract = z.infer<typeof jobRecordContract>;
export type BrandRecordContract = z.infer<typeof brandRecordContract>;
export type BrandProjectionRequestContract = z.infer<typeof brandProjectionRequestContract>;
