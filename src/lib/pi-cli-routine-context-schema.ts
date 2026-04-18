import { z } from "zod";

/**
 * Client-supplied routine context (schemas only — no graph/memory/composer deps).
 * Used by API routes and workflows so they can validate payloads without importing
 * {@link ./pi-cli-routine-context} (which pulls optional R2/memory/AST paths).
 */
export const routineContextPayloadSchema = z
  .object({
    file_sample_paths: z.array(z.string()).max(200).optional(),
    file_excerpts: z
      .array(
        z.object({
          path: z.string(),
          excerpt: z.string().max(20_000),
        })
      )
      .max(40)
      .optional(),
    import_histogram: z.record(z.number()).optional(),
    framework_hints: z.array(z.string()).max(80).optional(),
    polyglot_hints: z.array(z.string()).max(20).optional(),
    mastra_artifact_sample_paths: z.array(z.string()).max(40).optional(),
    existing_routine_slugs: z.array(z.string()).max(200).optional(),
    existing_routines_metadata: z
      .array(
        z.object({
          id: z.string(),
          tags: z.array(z.string()),
          intent: z.string(),
        })
      )
      .max(200)
      .optional(),
  })
  .strict();

export type RoutineContextPayload = z.infer<typeof routineContextPayloadSchema>;

export type GatheredRoutineContext = {
  memory_context: string;
  graph_summary: string;
  ast_summaries: string;
  system_style_summary: string;
  existing_routines_note: string;
  import_histogram_note: string;
  framework_hints_note: string;
  relevant_routines: Array<{
    routine_id: string;
    routine_file: string;
    relevance_score: number;
    reason: string;
  }>;
};
