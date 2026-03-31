import { z } from 'zod';

const MAX_CTX = 16_000;

const localeSchema = z.string().trim().min(2).max(32).optional();

export const notesStructureInputSchema = z.object({
  input: z.object({
    type: z.literal('clinical_notes'),
    data: z.string().trim().min(1).max(64_000),
    format_hint: z.string().trim().min(1).max(64).optional(),
  }),
  context: z
    .record(z.unknown())
    .refine((c) => JSON.stringify(c).length <= MAX_CTX, { message: 'context too large' })
    .optional(),
  output: z
    .object({
      locale: localeSchema,
      include_diagnostics: z.boolean().optional().default(false),
      format: z.enum(['report', 'json']).optional().default('json'),
    })
    .optional(),
});

export type NotesStructureInput = z.infer<typeof notesStructureInputSchema>;

const entitySymptom = z.object({
  name: z.string(),
  severity: z.string().optional(),
  onset: z.string().optional(),
  duration: z.string().optional(),
  status: z.string().optional(),
});

const entityCondition = z.object({
  name: z.string(),
  icd_hint: z.string().optional(),
  status: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const entityMed = z.object({
  name: z.string(),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  route: z.string().optional(),
  status: z.string().optional(),
  start_date: z.string().optional(),
});

export const notesStructureOutputSchema = z.object({
  summary: z.string().trim().min(1).max(16_000),
  disclaimer: z.string().trim().min(1).max(8000),
  symptoms: z.array(entitySymptom).max(100).default([]),
  conditions: z.array(entityCondition).max(80).default([]),
  medications: z.array(entityMed).max(80).default([]),
  risk_factors: z
    .array(
      z.object({
        factor: z.string(),
        detail: z.string().optional(),
      }),
    )
    .max(80)
    .default([]),
  timeline: z
    .array(
      z.object({
        date: z.string().optional(),
        event: z.string(),
        detail: z.string().optional(),
      }),
    )
    .max(200)
    .default([]),
  metadata: z.record(z.unknown()).optional(),
});

export type NotesStructureOutput = z.infer<typeof notesStructureOutputSchema>;

export const notesStructureDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(['ok', 'failed']),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export type NotesStructureDiagnosticsStep = z.infer<typeof notesStructureDiagnosticsStepSchema>;
