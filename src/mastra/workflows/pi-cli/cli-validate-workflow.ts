import { createStep, createWorkflow } from "@mastra/core/workflows";
import { generateObject } from "ai";
import { z } from "zod";

import { buildCliResourceId, buildCliThreadId } from "@/lib/pi-cli-thread";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";
import { PI_PERSONA_IDS, withPersonaPreamble } from "@/mastra/agents/_persona";

const violationSchema = z.object({
  rule: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  suggestion: z.string().optional(),
}).superRefine((data, ctx) => {
  // D5: Require non-empty suggestion for error violations
  if (data.severity === "error" && (!data.suggestion || data.suggestion.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "severity='error' violations must include a non-empty suggestion",
      path: ["suggestion"],
    });
  }
});

const semanticResponseSchema = z.object({
  semantic_violations: z.array(violationSchema),
  summary: z.string().optional(),
});

export const cliValidateWorkflowInputSchema = z.object({
  organization_id: z.string(),
  thread_id: z.string().optional(),
  intent: z.string().max(2000).optional(),
  local_violations: z.array(
    z.object({
      rule: z.string(),
      severity: z.enum(["error", "warning"]),
      message: z.string(),
      file: z.string(),
      line: z.number().optional(),
      column: z.number().optional(),
      suggestion: z.string().optional(),
    })
  ),
  routine_markdown: z.string().max(100_000).optional(),
  file_excerpts: z
    .array(
      z.object({
        path: z.string(),
        excerpt: z.string().max(20_000),
      })
    )
    .max(40)
    .optional(),
  persona: z.enum(PI_PERSONA_IDS).optional(),
});

const contextOutputSchema = cliValidateWorkflowInputSchema.extend({
  memoryContext: z.string(),
  intentConfidence: z.number(),
});

const collectContextStep = createStep({
  id: "collect-context",
  inputSchema: cliValidateWorkflowInputSchema,
  outputSchema: contextOutputSchema,
  execute: async ({ inputData }) => {
    let memoryContext = "";
    const { createPiCliMemory } = await import("@/lib/pi-cli-memory");
    const mem = createPiCliMemory();
    const threadId = inputData.thread_id?.trim();
    const learnThreadId = buildCliThreadId({
      organizationId: inputData.organization_id,
      branchName: "main",
      developerId: "system",
    });
    const pathHints = (inputData.file_excerpts ?? [])
      .map((f) => f.path)
      .join(" ")
      .slice(0, 1500);
    const vectorSearchString = [inputData.intent ?? "validation context", pathHints]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 2000);
    const threadConfig = {
      semanticRecall: Boolean(
        process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
          process.env.GEMINI_KEY?.trim() ||
          process.env.GEMINI_API_KEY?.trim()
      ),
    };
    if (mem && threadId) {
      try {
        const chunks: string[] = [];
        const { messages } = await mem.recall({
          threadId,
          perPage: 20,
          vectorSearchString,
          threadConfig,
        });
        chunks.push(
          ...messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        );
        if (learnThreadId !== threadId) {
          const learnRecall = await mem.recall({
            threadId: learnThreadId,
            perPage: 20,
            vectorSearchString: inputData.intent ?? "pi learn style rules",
            threadConfig,
          });
          chunks.push(
            ...learnRecall.messages.map((m) =>
              typeof m.content === "string" ? m.content : JSON.stringify(m.content)
            )
          );
        }
        memoryContext = chunks.join("\n").slice(0, 8000);
      } catch (e) {
        memoryContext = `(memory recall skipped: ${String(e)})`;
      }
    }

    let intentConfidence = 0.75;
    try {
      const model = getPiCliGeminiModel("lite");
      const { object } = await generateObject({
        model,
        schema: z.object({ intentConfidence: z.number().min(0).max(1) }),
        prompt: `Rate confidence that the following intent is clear and actionable for code review (0-1). Intent: ${inputData.intent ?? "(none)"}`,
        maxOutputTokens: 500,
      });
      intentConfidence = object.intentConfidence;
    } catch {
      intentConfidence = inputData.intent ? 0.82 : 0.55;
    }

    return {
      ...inputData,
      memoryContext,
      intentConfidence,
    };
  },
});

const highSemanticStep = createStep({
  id: "high-semantic",
  inputSchema: contextOutputSchema,
  outputSchema: semanticResponseSchema.extend({
    branch: z.literal("high"),
  }),
  execute: async ({ inputData, mastra }) => {
    const local = inputData.local_violations;
    if (!inputData.file_excerpts?.length && !inputData.routine_markdown) {
      return { semantic_violations: [], summary: undefined, branch: "high" as const };
    }

    try {
      const agent = mastra.getAgent("cliEnforcerAgent");
      const resource = buildCliResourceId(inputData.organization_id);
      const thread = inputData.thread_id?.trim() ?? `adhoc_${inputData.organization_id}`;

      const persona = inputData.persona ?? "normal";
      const prompt = withPersonaPreamble(
        persona,
        `You are Pi's semantic validator. Use tools if helpful. Ground in memory context when relevant.
Always pass organization_id: "${inputData.organization_id}" when calling query-dependency-graph.

Learned rules from pi learn + thread memory:
${inputData.memoryContext.slice(0, 4000)}

Intent: ${inputData.intent ?? "(none)"}

Routine (if any):
${(inputData.routine_markdown ?? "").slice(0, 24_000)}

Local deterministic violations (${local.length}):
${JSON.stringify(local, null, 2)}

File excerpts:
${(inputData.file_excerpts ?? [])
  .map((f) => `--- ${f.path}\n${f.excerpt}`)
  .join("\n\n")
  .slice(0, 48_000)}

Return only high-signal semantic issues; do not duplicate deterministic findings.`,
      );

      const result = await agent.generate([{ role: "user", content: prompt }], {
        structuredOutput: { schema: semanticResponseSchema },
        memory: { resource, thread },
      });

      const obj = result.object as z.infer<typeof semanticResponseSchema>;
      return { ...obj, branch: "high" as const };
    } catch (e) {
      console.warn("[cli-validate-workflow] agent_semantic_failed", e);
      const model = getPiCliGeminiModel("lite");
      const { object } = await generateObject({
        model,
        schema: semanticResponseSchema,
        prompt: `You are Pi's semantic validator...

Intent: ${inputData.intent ?? "(none)"}
Routine:
${(inputData.routine_markdown ?? "").slice(0, 24_000)}
Local:
${JSON.stringify(local, null, 2)}
Excerpts:
${(inputData.file_excerpts ?? [])
  .map((f) => `--- ${f.path}\n${f.excerpt}`)
  .join("\n\n")
  .slice(0, 48_000)}`,
        maxOutputTokens: 5000,
      });
      return { ...object, branch: "high" as const };
    }
  },
});

const lowAdaptiveStep = createStep({
  id: "low-adaptive",
  inputSchema: contextOutputSchema,
  outputSchema: semanticResponseSchema.extend({
    branch: z.literal("low"),
    adaptive_recommended: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    try {
      const { tasks } = await import("@trigger.dev/sdk/v3");
      await tasks.trigger("cli-adaptive-engine", {
        organizationId: inputData.organization_id,
        libraryHint: inputData.intent ?? "unknown",
        intentConfidence: inputData.intentConfidence,
      });
    } catch (e) {
      console.warn("[cli-validate-workflow] adaptive_trigger_failed", e);
    }

    return {
      semantic_violations: [],
      summary:
        "Intent confidence was below threshold; adaptive analysis was scheduled. Re-run validate after fixes.",
      branch: "low" as const,
      adaptive_recommended: true,
    };
  },
});

const mergeStep = createStep({
  id: "merge-output",
  inputSchema: z.object({
    "high-semantic": semanticResponseSchema.extend({ branch: z.literal("high") }).optional(),
    "low-adaptive": semanticResponseSchema
      .extend({
        branch: z.literal("low"),
        adaptive_recommended: z.boolean(),
      })
      .optional(),
  }),
  outputSchema: z.object({
    semantic_violations: z.array(violationSchema),
    summary: z.string().optional(),
    adaptive_recommended: z.boolean().optional(),
  }),
  execute: async ({ inputData }) => {
    const high = inputData["high-semantic"];
    const low = inputData["low-adaptive"];
    if (high) {
      return {
        semantic_violations: high.semantic_violations,
        summary: high.summary,
        adaptive_recommended: false,
      };
    }
    if (low) {
      return {
        semantic_violations: low.semantic_violations,
        summary: low.summary,
        adaptive_recommended: low.adaptive_recommended,
      };
    }
    return { semantic_violations: [], summary: undefined, adaptive_recommended: false };
  },
});

export const cliValidateWorkflow = createWorkflow({
  id: "cli-validate-workflow",
  inputSchema: cliValidateWorkflowInputSchema,
  outputSchema: z.object({
    semantic_violations: z.array(violationSchema),
    summary: z.string().optional(),
    adaptive_recommended: z.boolean().optional(),
  }),
})
  .then(collectContextStep)
  .branch([
    [async ({ inputData }) => inputData.intentConfidence > 0.6, highSemanticStep],
    [async ({ inputData }) => inputData.intentConfidence <= 0.6, lowAdaptiveStep],
  ])
  .then(mergeStep)
  .commit();
