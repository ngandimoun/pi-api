import { createStep, createWorkflow } from "@mastra/core/workflows";
import { generateObject } from "ai";
import { z } from "zod";

import { buildCliResourceId, buildCliThreadId } from "@/lib/pi-cli-thread";
import { createPiCliMemory, isCliMemoryEnabled } from "@/lib/pi-cli-memory";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";
import { uploadLatestPiSystemStyle } from "@/lib/pi-cli-r2";
import { tasks } from "@trigger.dev/sdk/v3";

const metadataSchema = z.object({
  package_json: z.record(z.unknown()).optional(),
  import_histogram: z.record(z.number()).optional(),
  file_sample_paths: z.array(z.string()).max(200).optional(),
  framework_hints: z.array(z.string()).optional(),
  polyglot_hints: z
    .object({
      counts_by_extension: z.record(z.number()).optional(),
      sample_paths: z.array(z.string()).max(200).optional(),
    })
    .optional(),
  file_sources: z
    .array(
      z.object({
        path: z.string(),
        content: z.string().max(64_000),
      })
    )
    .max(30)
    .optional(),
});

export const cliLearnWorkflowInputSchema = z.object({
  organization_id: z.string(),
  metadata: metadataSchema,
});

const systemStyleSchema = z.object({
  framework: z.string(),
  ui: z.string(),
  state: z.string(),
  patterns: z.object({
    imports: z.string(),
    components: z.string(),
    naming: z.string(),
    hooks: z.string(),
  }),
  libraries: z.array(z.string()),
  version: z.number().int().min(1),
});

const inferredSchema = cliLearnWorkflowInputSchema.extend({
  system_style: systemStyleSchema,
});

const inferStep = createStep({
  id: "infer-system-style",
  inputSchema: cliLearnWorkflowInputSchema,
  outputSchema: inferredSchema,
  execute: async ({ inputData }) => {
    const model = getPiCliGeminiModel("lite");
    const { object: system_style } = await generateObject({
      model,
      schema: systemStyleSchema,
      prompt: `You are Pi (Intelligence Infrastructure). Given structural metadata only (no raw source code), infer a concise system-style profile for this repository.

Metadata JSON:
${JSON.stringify(inputData.metadata, null, 2)}

Also use polyglot_hints (file extension counts + sample paths) to infer non-TS stacks present in the repo (Python/Go/Rust/etc). Mention them in libraries[] when credible.

Respond with best-effort labels (framework, ui library, state management, patterns, libraries).`,
    });
    return { ...inputData, system_style };
  },
});

const uploadSystemStyleStep = createStep({
  id: "upload-system-style-r2",
  inputSchema: inferredSchema,
  outputSchema: inferredSchema.extend({
    system_style_r2_key: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    let system_style_r2_key: string | undefined;
    try {
      if (process.env.R2_BUCKET_NAME?.trim() || process.env.R2_PI_GRAPHS_BUCKET?.trim()) {
        system_style_r2_key = await uploadLatestPiSystemStyle(inputData.organization_id, inputData.system_style);
      }
    } catch (e) {
      console.warn("[cli-learn-workflow] system_style_r2_upload_skipped", e);
    }
    return { ...inputData, system_style_r2_key };
  },
});

const inferredWithR2Schema = inferredSchema.extend({
  system_style_r2_key: z.string().optional(),
});

const persistMemoryStep = createStep({
  id: "persist-learn-memory",
  inputSchema: inferredWithR2Schema,
  outputSchema: inferredWithR2Schema.extend({
    rules_persisted: z.number().int().min(0),
  }),
  execute: async ({ inputData }) => {
    if (!isCliMemoryEnabled()) {
      return { ...inputData, rules_persisted: 0 };
    }
    const mem = createPiCliMemory();
    if (!mem) {
      return { ...inputData, rules_persisted: 0 };
    }
    const resourceId = buildCliResourceId(inputData.organization_id);
    const threadId = buildCliThreadId({
      organizationId: inputData.organization_id,
      branchName: "main",
      developerId: "system",
    });
    let rules_persisted = 0;
    try {
      await mem.createThread({
        resourceId,
        threadId,
        title: "Pi learn: style rules",
        saveThread: true,
      });
    } catch {
      /* thread may already exist */
    }
    const patterns = inputData.system_style.patterns;
    for (const key of ["imports", "components", "naming", "hooks"] as const) {
      const text = patterns[key];
      if (typeof text === "string" && text.trim()) {
        try {
          await mem.addMessage({
            threadId,
            resourceId,
            role: "assistant",
            type: "text",
            content: `Pi learn rule [${key}]: ${text}`,
          });
          rules_persisted += 1;
        } catch (e) {
          console.warn("[cli-learn-workflow] memory_rule_failed", key, e);
        }
      }
    }
    return { ...inputData, rules_persisted };
  },
});

const afterPersistSchema = inferredWithR2Schema.extend({
  rules_persisted: z.number().int().min(0),
});

const triggerGraphStep = createStep({
  id: "trigger-graph-builder",
  inputSchema: afterPersistSchema,
  outputSchema: afterPersistSchema.extend({
    graph_job_triggered: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    try {
      await tasks.trigger("cli-graph-builder", {
        organizationId: inputData.organization_id,
        fileSamplePaths: inputData.metadata.file_sample_paths ?? [],
        fileSources: inputData.metadata.file_sources,
      });
      return { ...inputData, graph_job_triggered: true };
    } catch (e) {
      console.warn("[cli-learn-workflow] graph_trigger_failed", e);
      return { ...inputData, graph_job_triggered: false };
    }
  },
});

const finalizeLearnStep = createStep({
  id: "finalize-learn",
  inputSchema: afterPersistSchema.extend({
    graph_job_triggered: z.boolean(),
  }),
  outputSchema: z.object({
    system_style: systemStyleSchema,
    graph_job_triggered: z.boolean(),
    rules_persisted: z.number().int().min(0),
  }),
  execute: async ({ inputData }) => ({
    system_style: inputData.system_style,
    graph_job_triggered: inputData.graph_job_triggered,
    rules_persisted: inputData.rules_persisted,
  }),
});

export const cliLearnWorkflow = createWorkflow({
  id: "cli-learn-workflow",
  inputSchema: cliLearnWorkflowInputSchema,
  outputSchema: z.object({
    system_style: systemStyleSchema,
    graph_job_triggered: z.boolean(),
    rules_persisted: z.number().int().min(0),
  }),
})
  .then(inferStep)
  .then(uploadSystemStyleStep)
  .then(persistMemoryStep)
  .then(triggerGraphStep)
  .then(finalizeLearnStep)
  .commit();
