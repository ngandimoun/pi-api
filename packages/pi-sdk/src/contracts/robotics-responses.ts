import { z } from 'zod';

import { successEnvelopeContract } from './brand-api.js';

export const robotZoneRowSchema = z.object({
  id: z.string().uuid(),
  robot_id: z.string().nullable(),
  name: z.string(),
  zone_type: z.string(),
  frame: z.string(),
  polygon: z.array(z.array(z.number())),
  metadata: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const robotZonesListResponseSchema = successEnvelopeContract(
  z.object({
    zones: z.array(robotZoneRowSchema),
  }),
);

export const robotZonesCreateResponseSchema = successEnvelopeContract(
  z.object({
    created: z.number().int(),
  }),
);

export const robotBehaviorsListResponseSchema = successEnvelopeContract(
  z.object({
    behaviors: z.array(z.record(z.unknown())),
  }),
);

export const robotBehaviorsCreateResponseSchema = successEnvelopeContract(
  z.object({
    ok: z.literal(true),
  }),
);

export const robotActionsListResponseSchema = successEnvelopeContract(
  z.object({
    actions: z.array(z.record(z.unknown())),
  }),
);

export const robotActionsCreateResponseSchema = successEnvelopeContract(
  z.object({
    created: z.number().int(),
  }),
);
