import { z } from 'zod';

import { successEnvelopeContract } from './brand-api.js';

export const surveillancePoliciesListResponseSchema = successEnvelopeContract(
  z.object({
    policies: z.array(z.record(z.unknown())),
  }),
);

export const surveillancePolicyUpsertResponseSchema = successEnvelopeContract(
  z.object({
    policy: z.record(z.unknown()),
  }),
);
