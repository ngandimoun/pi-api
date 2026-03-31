import { z } from 'zod';

import { successEnvelopeContract } from './brand-api.js';

export const runActionSchema = z.enum([
  'brands.extract',
  'campaigns.generate',
  'campaigns.edit',
  'campaigns.localize_ad',
]);

export const runStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
]);

export const runStepStatusSchema = z.enum([
  'pending',
  'queued',
  'processing',
  'completed',
  'failed',
  'skipped',
]);

export const runStepDefinitionSchema = z.object({
  id: z.string().trim().min(1).max(64),
  action: runActionSchema,
  input: z.record(z.unknown()).default({}),
  depends_on: z.array(z.string().trim().min(1).max(64)).default([]),
  input_map: z.record(z.string()).optional(),
});

export const createRunInputSchema = z.object({
  steps: z.array(runStepDefinitionSchema).min(1).max(10),
  metadata: z.record(z.unknown()).optional(),
});

export const runStepResultSchema = z.object({
  id: z.string().min(1),
  action: runActionSchema,
  status: runStepStatusSchema,
  depends_on: z.array(z.string()).default([]),
  job_id: z.string().uuid().nullable().optional(),
  result: z.record(z.unknown()).nullable().optional(),
  error: z.string().nullable().optional(),
  started_at: z.number().int().nullable().optional(),
  completed_at: z.number().int().nullable().optional(),
});

export const runRecordSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  status: runStatusSchema,
  steps: z.array(runStepResultSchema),
  metadata: z.record(z.unknown()).nullable().optional(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
});

export const runCreateResponseContract = successEnvelopeContract(
  z.object({
    run_id: z.string().uuid(),
    status: runStatusSchema,
    steps: z.array(
      z.object({
        id: z.string(),
        status: runStepStatusSchema,
      }),
    ),
  }),
);

export const runRetrieveContract = successEnvelopeContract(runRecordSchema);

export type CreateRunInput = z.infer<typeof createRunInputSchema>;
export type RunStepDefinition = z.infer<typeof runStepDefinitionSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
