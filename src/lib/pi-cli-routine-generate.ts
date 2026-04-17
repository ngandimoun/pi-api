import { generateObject } from "ai";
import {
  executionPlanSchema,
  renderExecutionPlan,
  routineSpecToMarkdown,
  routineSpecificationSchema,
} from "pi-routine-spec";

import type { RoutineMatch } from "@/lib/pi-cli-routine-composer";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";

export type RoutineDraftGatheredInput = {
  intent: string;
  doc_snippets: string[];
  system_style_summary: string;
  import_histogram_note: string;
  framework_hints_note: string;
  graph_summary: string;
  ast_summaries: string;
  memory_context: string;
  existing_routines_note: string;
  relevant_routines?: RoutineMatch[];
};

export function slugFromIntent(intent: string): string {
  return (
    intent
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "routine"
  );
}

function formatRelevantRoutinesBlock(matches: RoutineMatch[] | undefined): string {
  if (!matches?.length) return "";
  return `**Relevant existing routines (ranked):**
${matches
  .map(
    (r) =>
      `- \`${r.routine_id}\` (score ${r.relevance_score}): ${r.reason}
  File pattern: ${r.routine_file}`
  )
  .join("\n")}

If this intent spans multiple concerns already covered above:
1. Set metadata.references to the routine ids the executor must complete first.
2. Add a clear "## Related Routines" narrative in phases or description — focus this spec on **new glue / integration** only.
3. List every repo file touchpoint in files_manifest (not one monolithic blob).`;
}

export type PiRoutineDraftResult = {
  slug: string;
  markdown: string;
  routine_spec_json?: string;
  /** When present, also write `${execution_plan_slug}.md` (execution plan for agents). */
  execution_plan_markdown?: string;
  execution_plan_slug?: string;
};

/**
 * Shared structured routine generation (workflow step + HTTP fallback).
 * Pi routine v2 only: structured generation must succeed (no legacy Markdown fallback).
 */
export async function generatePiRoutineDraft(
  input: RoutineDraftGatheredInput
): Promise<PiRoutineDraftResult> {
  const model = getPiCliGeminiModel("pro");
  const slug = slugFromIntent(input.intent);

  const high = (input.relevant_routines ?? []).filter((r) => r.relevance_score > 0.6);
  if (high.length >= 2) {
    const planId = `${slug}-plan`;
    const plan = executionPlanSchema.parse({
      plan_id: planId,
      intent: input.intent,
      routines: high.slice(0, 8).map((r, i) => ({
        routine_id: r.routine_id,
        routine_file: r.routine_file,
        execution_order: i + 1,
        reason: r.reason,
      })),
      glue_routine: {
        routine_id: `${slug}-glue`,
        description: "Integration work that connects the routines above for this intent.",
      },
    });
    const execution_plan_markdown = renderExecutionPlan(plan);
    const glueId = `${slug}-glue`;

    const gluePrompt = `You are Pi, the Architect Agent. Produce structured JSON (RoutineSpecification schema) for a **glue / integration** routine only.

The coding agent will already execute these saved routines first (in order): ${high.map((h) => h.routine_id).join(", ")}.

**Intent (full):** ${input.intent}

**Glue routine id (metadata.id must match exactly):** ${glueId}

**Relevant system style (curated):**
${input.system_style_summary}

**Import / stack signals:**
${input.import_histogram_note}
${input.framework_hints_note ? `\n${input.framework_hints_note}` : ""}

**Dependency / file graph:**
${input.graph_summary}

**AST / excerpt hints:**
${input.ast_summaries}

Rules:
1. metadata.references MUST include the routine ids above that this glue connects.
2. phases + files_manifest cover only **new** integration files (bridges, shared config, sequencing), not duplicates of prior routines.
3. constraints: spell out imports/paths that must be shared across the integrated areas.
4. Do not include full source code — specification only.`;

    try {
      const { object } = await generateObject({
        model,
        schema: routineSpecificationSchema,
        prompt: gluePrompt,
      });
      const spec = routineSpecificationSchema.parse(object);
      const fixed = {
        ...spec,
        metadata: {
          ...spec.metadata,
          id: glueId,
          intent: `Glue: ${input.intent}`,
          version: spec.metadata.version ?? 1,
          references: Array.from(new Set([...high.map((h) => h.routine_id), ...(spec.metadata.references ?? [])])),
        },
      };
      const markdown = routineSpecToMarkdown(fixed);
      return {
        slug: glueId,
        markdown,
        routine_spec_json: JSON.stringify(fixed),
        execution_plan_markdown,
        execution_plan_slug: planId,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Pi execution-plan glue generation failed (no legacy fallback). ${msg}. ` +
          `Check model structured output support and prompt/schema alignment.`
      );
    }
  }

  const docBlock = input.doc_snippets.length
    ? input.doc_snippets.join("\n\n")
    : "(no external doc URLs provided.)";

  const relevantBlock = formatRelevantRoutinesBlock(input.relevant_routines);

  const architectPrompt = `You are Pi, the Architect Agent. Produce a machine-readable execution plan as structured JSON (RoutineSpecification schema).

The coding executor (Cursor, Claude Code, Windsurf, etc.) will follow this spec. Pi does NOT run terminal commands — list them as steps for the human/agent executor only.

**Intent:** ${input.intent}

**Routine id (metadata.id must match exactly):** ${slug}

${relevantBlock ? `${relevantBlock}\n\n` : ""}
**Relevant system style (curated):**
${input.system_style_summary}

**Import / stack signals:**
${input.import_histogram_note}
${input.framework_hints_note ? `\n${input.framework_hints_note}` : ""}

**Dependency / file graph (from Pi import graph when available):**
${input.graph_summary}

**AST / excerpt hints:**
${input.ast_summaries}

**Prior memory / learn thread (may be empty):**
${input.memory_context || "(none)"}

**Existing routines (avoid duplicating; reference by id when extending):**
${input.existing_routines_note}

**External documentation excerpts:**
${docBlock}

Rules:
1. Fill framework string from hints + system style (e.g. Next.js App Router).
2. existing_patterns: list concrete import paths / component paths inferred from graph and AST (use repo-relative paths when given).
3. constraints.must_use / must_not / conventions: be specific (e.g. exact import paths, security limits).
4. phases: ordered, actionable steps; use action verify when checking only; run_command for shell steps the executor should run.
5. validation: required files, exports, and test commands that prove success.
6. metadata.tags: 3–8 short tags; metadata.references: slugs of prior routines if this extends them (use ranked list above when applicable).
7. metadata.created_at: use ISO-8601 UTC now.
8. Do not include full source code — specification only.
9. files_manifest: list ALL repo files this routine creates, modifies, or verifies — each entry: path, purpose, depends_on (other paths), action create|modify|verify. Prefer multiple focused files over one monolithic file.
10. Align files_manifest with phases; every create/modify file_path in steps should appear in files_manifest.`;

  try {
    const { object } = await generateObject({
      model,
      schema: routineSpecificationSchema,
      prompt: architectPrompt,
    });
    const spec = routineSpecificationSchema.parse(object);
    const fixed = {
      ...spec,
      metadata: {
        ...spec.metadata,
        id: slug,
        intent: input.intent,
        version: spec.metadata.version ?? 1,
      },
    };
    const markdown = routineSpecToMarkdown(fixed);
    return { slug, markdown, routine_spec_json: JSON.stringify(fixed) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Pi routine v2 structured generation failed (no legacy fallback). ${msg}. ` +
        `Check model structured output support and prompt/schema alignment.`
    );
  }
}
