import { z } from "zod";

export const routineStepActionSchema = z.enum([
  "create_file",
  "run_command",
  "modify_file",
  "verify",
  "other",
]);

export const routineStepSchema = z.object({
  id: z.string().min(1),
  action: routineStepActionSchema,
  description: z.string().min(1),
  file_path: z.string().optional(),
  command: z.string().optional(),
  critical_rules: z.array(z.string()).default([]),
  validation_checks: z.array(z.string()).default([]),
  depends_on_steps: z.array(z.string()).default([]),
});

export const routinePhaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(routineStepSchema).min(1),
  depends_on_phases: z.array(z.string()).default([]),
  unlock_condition: z
    .object({
      type: z.enum(["manual", "check_pass", "test_pass"]),
      details: z.string().optional(),
    })
    .optional(),
});

export const routineConstraintsSchema = z.object({
  must_use: z.array(z.string()).default([]),
  must_not: z.array(z.string()).default([]),
  conventions: z.array(z.string()).default([]),
});

export const routineContextBlockSchema = z.object({
  framework: z.string().default(""),
  existing_patterns: z
    .object({
      imports: z.array(z.string()).default([]),
      components: z.array(z.string()).default([]),
      hooks: z.array(z.string()).default([]),
    })
    .default({ imports: [], components: [], hooks: [] }),
  constraints: routineConstraintsSchema.default({
    must_use: [],
    must_not: [],
    conventions: [],
  }),
});

export const routineValidationSchema = z.object({
  required_files: z.array(z.string()).default([]),
  required_exports: z.array(z.string()).default([]),
  test_commands: z.array(z.string()).default([]),
});

export const routineMetadataSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  intent: z.string().min(1),
  created_at: z.string().optional(),
  tags: z.array(z.string()).default([]),
  references: z.array(z.string()).default([]),
});

export const routineFileEntrySchema = z.object({
  path: z.string().min(1),
  purpose: z.string().min(1),
  depends_on: z.array(z.string()).default([]),
  action: z.enum(["create", "modify", "verify"]),
});

export const routineSpecificationSchema = z.object({
  metadata: routineMetadataSchema,
  context: routineContextBlockSchema,
  /** All repo files this routine creates, modifies, or verifies (executor scope). */
  files_manifest: z.array(routineFileEntrySchema).default([]),
  phases: z.array(routinePhaseSchema).min(1),
  validation: routineValidationSchema.default({
    required_files: [],
    required_exports: [],
    test_commands: [],
  }),
});

export type RoutineSpecification = z.infer<typeof routineSpecificationSchema>;
export type RoutineFileEntry = z.infer<typeof routineFileEntrySchema>;
export type RoutineMetadata = z.infer<typeof routineMetadataSchema>;
export type RoutinePhase = z.infer<typeof routinePhaseSchema>;
export type RoutineStep = z.infer<typeof routineStepSchema>;
