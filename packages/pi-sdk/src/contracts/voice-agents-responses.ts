import { z } from 'zod';

import { successEnvelopeContract } from './brand-api.js';

export const voiceAgentCreateResponseSchema = successEnvelopeContract(
  z.object({
    agent_id: z.string().uuid(),
    name: z.string(),
    created_at: z.number().int(),
  }),
);

export const voiceAgentListItemSchema = z.object({
  agent_id: z.string().uuid(),
  name: z.string(),
  language: z.string(),
  purpose: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
});

export const voiceAgentListResponseSchema = successEnvelopeContract(
  z.object({
    object: z.literal('list'),
    data: z.array(voiceAgentListItemSchema),
    has_more: z.boolean(),
    total_count: z.number(),
  }),
);

export const voiceAgentRetrieveResponseSchema = successEnvelopeContract(
  z.object({
    agent_id: z.string().uuid(),
    name: z.string(),
    language: z.string(),
    purpose: z.string().nullable().optional(),
    instructions: z.string(),
    questions: z.array(z.unknown()),
    behaviors: z.record(z.unknown()),
    output_schema: z.record(z.unknown()),
    output_schema_strict: z.record(z.unknown()).nullable(),
    extraction_model: z.string().nullable(),
    voice: z.record(z.unknown()),
    metadata: z.record(z.unknown()),
    is_active: z.boolean(),
    created_at: z.number().int(),
    updated_at: z.number().int(),
  }),
);

export const voiceAgentDeleteResponseSchema = successEnvelopeContract(
  z.object({
    agent_id: z.string().uuid(),
    deleted: z.literal(true),
  }),
);
