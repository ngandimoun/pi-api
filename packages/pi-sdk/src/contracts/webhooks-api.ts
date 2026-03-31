import { z } from 'zod';

import { successEnvelopeContract } from './brand-api.js';

export const webhookSchema = z.object({
  object: z.literal('webhook'),
  id: z.string().uuid(),
  endpoint_url: z.string().url(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const webhookCreateInputSchema = z.object({
  endpoint_url: z.string().url(),
  secret: z.string().trim().min(8).max(500),
});

export const webhookUpdateInputSchema = z.object({
  is_active: z.boolean().optional(),
});

export const webhookListResponseSchema = successEnvelopeContract(
  z.object({
    object: z.literal('list'),
    data: z.array(
      z.object({
        id: z.string().uuid(),
        endpoint_url: z.string().url(),
        is_active: z.boolean(),
        created_at: z.string(),
        updated_at: z.string(),
      }),
    ),
  }),
);

export const webhookResponseSchema = successEnvelopeContract(
  z.object({
    object: z.literal('webhook'),
    id: z.string().uuid(),
    endpoint_url: z.string().url(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);
