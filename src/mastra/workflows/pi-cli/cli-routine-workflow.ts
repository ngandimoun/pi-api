import { createStep, createWorkflow } from "@mastra/core/workflows";
import { generateText } from "ai";
import { z } from "zod";

import { gatherRoutineContext, routineContextPayloadSchema } from "@/lib/pi-cli-routine-context";
import { generatePiRoutineDraft } from "@/lib/pi-cli-routine-generate";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";

export const cliRoutineWorkflowInputSchema = z.object({
  organization_id: z.string(),
  thread_id: z.string().optional(),
  intent: z.string().min(3).max(4000),
  system_style: z.record(z.unknown()).optional(),
  doc_urls: z.array(z.string().url()).max(5).optional(),
  require_approval: z.boolean().optional(),
  routine_context: routineContextPayloadSchema.optional(),
});

const afterScrapeSchema = cliRoutineWorkflowInputSchema.extend({
  doc_snippets: z.array(z.string()),
});

const relevantRoutineSchema = z.object({
  routine_id: z.string(),
  routine_file: z.string(),
  relevance_score: z.number(),
  reason: z.string(),
});

const afterGatherSchema = afterScrapeSchema.extend({
  memory_context: z.string(),
  graph_summary: z.string(),
  ast_summaries: z.string(),
  system_style_summary: z.string(),
  existing_routines_note: z.string(),
  import_histogram_note: z.string(),
  framework_hints_note: z.string(),
  relevant_routines: z.array(relevantRoutineSchema),
});

const afterGenerateSchema = afterGatherSchema.extend({
  slug: z.string(),
  draft_markdown: z.string(),
  routine_spec_json: z.string().optional(),
  execution_plan_markdown: z.string().optional(),
  execution_plan_slug: z.string().optional(),
});

const scrapeStep = createStep({
  id: "scrape-docs",
  inputSchema: cliRoutineWorkflowInputSchema,
  outputSchema: afterScrapeSchema,
  execute: async ({ inputData }) => {
    const doc_snippets: string[] = [];
    const { scrapeBrandingProfile } = await import("@/lib/firecrawl");
    for (const url of inputData.doc_urls ?? []) {
      try {
        const scraped = await scrapeBrandingProfile(url);
        doc_snippets.push(`### ${url}\n${scraped.markdown.slice(0, 12_000)}`);
      } catch (e) {
        doc_snippets.push(`### ${url}\n(failed to scrape: ${e instanceof Error ? e.message : "error"})`);
      }
    }
    return { ...inputData, doc_snippets };
  },
});

const gatherContextStep = createStep({
  id: "gather-codebase-context",
  inputSchema: afterScrapeSchema,
  outputSchema: afterGatherSchema,
  execute: async ({ inputData }) => {
    const gathered = await gatherRoutineContext({
      organization_id: inputData.organization_id,
      thread_id: inputData.thread_id,
      intent: inputData.intent,
      system_style: inputData.system_style,
      routine_context: inputData.routine_context,
    });
    return {
      ...inputData,
      ...gathered,
    };
  },
});

const generateDraftStep = createStep({
  id: "generate-draft",
  inputSchema: afterGatherSchema,
  outputSchema: afterGenerateSchema,
  execute: async ({ inputData }) => {
    const draft = await generatePiRoutineDraft({
      intent: inputData.intent,
      doc_snippets: inputData.doc_snippets,
      system_style_summary: inputData.system_style_summary,
      import_histogram_note: inputData.import_histogram_note,
      framework_hints_note: inputData.framework_hints_note,
      graph_summary: inputData.graph_summary,
      ast_summaries: inputData.ast_summaries,
      memory_context: inputData.memory_context,
      existing_routines_note: inputData.existing_routines_note,
      relevant_routines: inputData.relevant_routines,
    });
    return {
      ...inputData,
      slug: draft.slug,
      draft_markdown: draft.markdown,
      routine_spec_json: draft.routine_spec_json,
      execution_plan_markdown: draft.execution_plan_markdown,
      execution_plan_slug: draft.execution_plan_slug,
    };
  },
});

const hitlStep = createStep({
  id: "human-approval",
  inputSchema: afterGenerateSchema,
  outputSchema: z.object({
    slug: z.string(),
    markdown: z.string(),
    version: z.number().min(0),
    routine_spec_json: z.string().optional(),
    execution_plan_markdown: z.string().optional(),
    execution_plan_slug: z.string().optional(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    feedback: z.string().optional(),
  }),
  suspendSchema: z.object({
    draft_markdown: z.string(),
    message: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    if (!inputData.require_approval) {
      return {
        slug: inputData.slug,
        markdown: inputData.draft_markdown,
        version: 1,
        routine_spec_json: inputData.routine_spec_json,
        execution_plan_markdown: inputData.execution_plan_markdown,
        execution_plan_slug: inputData.execution_plan_slug,
      };
    }

    const { approved, feedback } = resumeData ?? {};

    if (!resumeData) {
      return await suspend({
        draft_markdown: inputData.draft_markdown,
        message: "Review the draft routine. Resume with approved:true or feedback to regenerate.",
      });
    }

    if (approved === false && !feedback?.trim()) {
      return bail({
        slug: inputData.slug,
        markdown: "",
        version: 0,
        routine_spec_json: undefined,
        execution_plan_markdown: undefined,
        execution_plan_slug: undefined,
      });
    }

    if (feedback?.trim()) {
      const model = getPiCliGeminiModel("pro");
      const { text } = await generateText({
        model,
        prompt: `Rewrite the routine Markdown incorporating reviewer feedback. Keep YAML frontmatter if present. Stay specification-only (no full implementation code).

Feedback:
${feedback}

Previous draft:
${inputData.draft_markdown}`,
      });
      return {
        slug: inputData.slug,
        markdown: text,
        version: 1,
        routine_spec_json: undefined,
        execution_plan_markdown: inputData.execution_plan_markdown,
        execution_plan_slug: inputData.execution_plan_slug,
      };
    }

    return {
      slug: inputData.slug,
      markdown: inputData.draft_markdown,
      version: 1,
      routine_spec_json: inputData.routine_spec_json,
      execution_plan_markdown: inputData.execution_plan_markdown,
      execution_plan_slug: inputData.execution_plan_slug,
    };
  },
});

export const cliRoutineWorkflow = createWorkflow({
  id: "cli-routine-workflow",
  inputSchema: cliRoutineWorkflowInputSchema,
  outputSchema: z.object({
    slug: z.string(),
    markdown: z.string(),
    version: z.number().min(0),
    routine_spec_json: z.string().optional(),
    execution_plan_markdown: z.string().optional(),
    execution_plan_slug: z.string().optional(),
  }),
})
  .then(scrapeStep)
  .then(gatherContextStep)
  .then(generateDraftStep)
  .then(hitlStep)
  .commit();
