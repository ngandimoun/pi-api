import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { createPiCliMemory } from "@/lib/pi-cli-memory";
import { buildCliResourceId, buildCliThreadId } from "@/lib/pi-cli-thread";
import { buildDeterministicFacts } from "@/lib/pi-cli-resonate-deterministic";
import { gatherRoutineContext, routineContextPayloadSchema } from "@/lib/pi-cli-routine-context";
import type { GatheredRoutineContext } from "@/lib/pi-cli-routine-context";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";
import { PI_PERSONA_IDS, withPersonaPreamble } from "@/mastra/agents/_persona";
import { generateObject } from "ai";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(32_000),
});

const alternativePathSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  tradeoffs: z.string(),
});

const socraticChallengeSchema = z.object({
  understanding: z.string(),
  missing_prerequisites: z.array(z.string()).max(16),
  architectural_traps: z.array(z.string()).max(16),
  alternative_paths: z.array(alternativePathSchema).max(8),
  probing_question: z.string(),
  risks: z.array(z.string()).max(16),
  invariants: z.array(z.string()).max(16),
  claims: z.array(z.object({ claim: z.string(), source: z.string() })).max(24),
  conflict_type: z.enum(["hard_constraint", "pattern_divergence", "preference", "none"]),
  files_likely_touched: z.array(z.string()).max(80).optional(),
  is_ready: z.boolean(),
});

const groundingQualitySchema = z.object({
  graph_available: z.boolean(),
  style_available: z.boolean(),
  excerpts_count: z.number(),
  constitution_loaded: z.boolean(),
});

const astInsightsSchema = z.object({
  blast_radius_summaries: z.array(z.string()),
  missing_prerequisites: z.array(z.string()),
  prerequisite_severity: z.enum(["none", "low", "medium", "high"]),
  boundary_violations: z.array(z.string()),
});

export const cliResonateWorkflowInputSchema = z.object({
  organization_id: z.string(),
  intent: z.string().min(3).max(4000),
  messages: z.array(messageSchema).min(1).max(80),
  branch_name: z.string().max(256).optional(),
  developer_id: z.string().max(256).optional(),
  system_style: z.record(z.unknown()).optional(),
  routine_context: routineContextPayloadSchema.optional(),
  mode: z.enum(["explore", "challenge", "decision"]).optional(),
  depth: z.enum(["fast", "deep"]).optional(),
  constitution: z.string().max(100_000).optional(),
  git_diff_summary: z.string().max(100_000).optional(),
  persona: z.enum(PI_PERSONA_IDS).optional(),
});

// ---------------------------------------------------------------------------
// Step 1: Hydrate Context
// ---------------------------------------------------------------------------

const hydrateOutputSchema = cliResonateWorkflowInputSchema.extend({
  thread_id: z.string(),
  resource_id: z.string(),
  deterministic_facts: z.string(),
  memory_context: z.string(),
  graph_summary: z.string(),
  ast_summaries: z.string(),
  system_style_summary: z.string(),
  existing_routines_note: z.string(),
  import_histogram_note: z.string(),
  framework_hints_note: z.string(),
  grounding_quality: groundingQualitySchema,
});

const hydrateContextStep = createStep({
  id: "hydrate-context",
  inputSchema: cliResonateWorkflowInputSchema,
  outputSchema: hydrateOutputSchema,
  execute: async ({ inputData }) => {
    const threadId = buildCliThreadId({
      organizationId: inputData.organization_id,
      branchName: inputData.branch_name ?? "default",
      developerId: inputData.developer_id,
    });
    const resourceId = buildCliResourceId(inputData.organization_id);

    const gathered = await gatherRoutineContext({
      organization_id: inputData.organization_id,
      thread_id: threadId,
      intent: inputData.intent,
      system_style: inputData.system_style,
      routine_context: inputData.routine_context,
    });

    const depth = inputData.depth ?? "fast";
    const effectiveGathered: GatheredRoutineContext =
      depth === "fast"
        ? {
            ...gathered,
            ast_summaries: "(skipped in fast depth)",
            graph_summary: gathered.graph_summary.slice(0, 2000),
          }
        : gathered;

    const deterministicFacts = buildDeterministicFacts({
      gathered: effectiveGathered,
      gitDiffSummary: inputData.git_diff_summary,
    });

    const excerptCount = inputData.routine_context?.file_excerpts?.length ?? 0;
    const grounding_quality = {
      graph_available: !gathered.graph_summary.trim().startsWith("(no import graph"),
      style_available: !gathered.system_style_summary.trim().startsWith("(no system_style"),
      excerpts_count: excerptCount,
      constitution_loaded: Boolean(inputData.constitution?.trim()),
    };

    return {
      ...inputData,
      thread_id: threadId,
      resource_id: resourceId,
      deterministic_facts: deterministicFacts,
      memory_context: effectiveGathered.memory_context,
      graph_summary: effectiveGathered.graph_summary,
      ast_summaries: effectiveGathered.ast_summaries,
      system_style_summary: effectiveGathered.system_style_summary,
      existing_routines_note: effectiveGathered.existing_routines_note,
      import_histogram_note: effectiveGathered.import_histogram_note,
      framework_hints_note: effectiveGathered.framework_hints_note,
      grounding_quality,
    };
  },
});

// ---------------------------------------------------------------------------
// Step 2: AST Analysis
// ---------------------------------------------------------------------------

const afterAstSchema = hydrateOutputSchema.extend({
  ast_insights: astInsightsSchema,
});

const astAnalysisStep = createStep({
  id: "ast-analysis",
  inputSchema: hydrateOutputSchema,
  outputSchema: afterAstSchema,
  execute: async ({ inputData }) => {
    const excerpts = inputData.routine_context?.file_excerpts ?? [];
    const deps = (inputData.system_style as Record<string, unknown> | undefined) ?? {};

    const blastSummaries: string[] = [];
    const allBoundaryViolations: string[] = [];
    let missingPrereqs: string[] = [];
    let prereqSeverity: "none" | "low" | "medium" | "high" = "none";

    if (excerpts.length > 0) {
      // Prerequisite scan
      try {
        const { prerequisiteScannerTool } = await import("@/mastra/tools/prerequisite-scanner-tool");
        const prereqResult = await prerequisiteScannerTool.execute({
          feature_intent: inputData.intent,
          file_excerpts: excerpts,
          package_json_deps: (deps as Record<string, string>) ?? undefined,
        });
        missingPrereqs = prereqResult.missing_prerequisites;
        prereqSeverity = prereqResult.severity;
      } catch {
        missingPrereqs = [];
      }

      // Boundary checks on layout/page files
      try {
        const { architecturalBoundaryTool } = await import("@/mastra/tools/architectural-boundary-tool");
        for (const ex of excerpts.slice(0, 10)) {
          if (/\.(tsx|jsx)$/.test(ex.path)) {
            const result = await architecturalBoundaryTool.execute({
              file_path: ex.path,
              excerpt: ex.excerpt,
            });
            allBoundaryViolations.push(...result.boundary_violations);
          }
        }
      } catch {
        // AST boundary check non-critical
      }

      // Blast radius for key symbols mentioned in the intent
      try {
        const { blastRadiusTool } = await import("@/mastra/tools/blast-radius-tool");
        const intentWords = inputData.intent
          .split(/\s+/)
          .filter((w) => /^[A-Z][a-zA-Z]+$/.test(w))
          .slice(0, 3);
        for (const symbol of intentWords) {
          const matchingExcerpt = excerpts.find(
            (e) => e.excerpt.includes(`export`) && e.excerpt.includes(symbol)
          );
          if (matchingExcerpt) {
            const result = await blastRadiusTool.execute({
              target_symbol: symbol,
              file_path: matchingExcerpt.path,
              file_excerpts: excerpts,
            });
            if (result.impacted_files.length > 0) {
              blastSummaries.push(result.blast_summary);
            }
          }
        }
      } catch {
        // Blast radius non-critical
      }
    }

    return {
      ...inputData,
      ast_insights: {
        blast_radius_summaries: blastSummaries,
        missing_prerequisites: missingPrereqs,
        prerequisite_severity: prereqSeverity,
        boundary_violations: allBoundaryViolations,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Step 3+4+5: Socratic Debate Loop (formulate + suspend + process)
// ---------------------------------------------------------------------------

function modeBlock(mode: "explore" | "challenge" | "decision" | undefined): string {
  const m = mode ?? "challenge";
  if (m === "explore") {
    return `## Session mode: EXPLORE\nAsk broad questions. Map the design space. Do not force convergence until the user commits.`;
  }
  if (m === "decision") {
    return `## Session mode: DECISION\nForce a concrete A/B choice. Resolve or defer each open question before completion.`;
  }
  return `## Session mode: CHALLENGE\nDispute weak premises. Every turn must surface at least one risk, tradeoff, or conflict with repo evidence.`;
}

function buildSocraticPrompt(data: z.infer<typeof afterAstSchema>): string {
  const astBlock =
    data.ast_insights.missing_prerequisites.length > 0 ||
    data.ast_insights.boundary_violations.length > 0 ||
    data.ast_insights.blast_radius_summaries.length > 0
      ? `## AST Analysis (deterministic — ts-morph verified)
${data.ast_insights.missing_prerequisites.length > 0 ? `### Missing Prerequisites (severity: ${data.ast_insights.prerequisite_severity})\n${data.ast_insights.missing_prerequisites.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}
${data.ast_insights.boundary_violations.length > 0 ? `### Architectural Boundary Violations\n${data.ast_insights.boundary_violations.map((v, i) => `${i + 1}. ${v}`).join("\n")}` : ""}
${data.ast_insights.blast_radius_summaries.length > 0 ? `### Blast Radius\n${data.ast_insights.blast_radius_summaries.join("\n")}` : ""}`
      : "";

  const constBlock = data.constitution?.trim()
    ? `## HARD CONSTRAINTS (non-negotiable — from .pi/constitution.md)\n${data.constitution.trim().slice(0, 50_000)}`
    : "";

  const diffBlock = data.git_diff_summary?.trim()
    ? `## Current working tree / staged changes (highest priority)\n${data.git_diff_summary.trim().slice(0, 90_000)}`
    : "";

  const conversation = data.messages
    .map((m) => `${m.role === "user" ? "User" : "Pi"}: ${m.content}`)
    .join("\n\n");

  return `${modeBlock(data.mode)}

## Session metadata
organization_id: "${data.organization_id}"
Feature intent: ${data.intent}

${constBlock}
${diffBlock}
${astBlock}

## MUST-RECONCILE FACTS (deterministic)
${data.deterministic_facts}

## system_style summary
${data.system_style_summary.slice(0, 8000)}

## Repo signals
### Memory context
${data.memory_context.slice(0, 8000)}
### Import graph
${data.graph_summary.slice(0, 12_000)}
### AST hints
${data.ast_summaries.slice(0, 12_000)}
### Existing routines
${data.existing_routines_note.slice(0, 6000)}

## Conversation (respond to latest User turn)
${conversation}

## Output rules
You are a Staff Engineer. Output a Socratic challenge as structured JSON.
- understanding: summarize what the user wants
- missing_prerequisites: things that must exist before this feature can work (cite AST analysis when available)
- architectural_traps: things that will break if done naively
- alternative_paths: 2-4 concrete options with tradeoffs
- probing_question: the single most important question the dev must answer
- risks, invariants, claims (with source), conflict_type, files_likely_touched
- is_ready: true only when the developer has addressed all concerns and a clear path exists
- Do NOT write code. Reference paths in plain text only.`;
}

const socraticDebateStep = createStep({
  id: "socratic-debate",
  inputSchema: afterAstSchema,
  outputSchema: z.object({
    challenge: socraticChallengeSchema,
    conversation: z.array(messageSchema),
    grounding_quality: groundingQualitySchema,
    thread_id: z.string(),
    resource_id: z.string(),
    intent: z.string(),
    branch_name: z.string().optional(),
    developer_id: z.string().optional(),
    organization_id: z.string(),
    is_consensus: z.boolean(),
    ast_insights: astInsightsSchema,
    mode: z.enum(["explore", "challenge", "decision"]).optional(),
  }),
  suspendSchema: z.object({
    challenge: socraticChallengeSchema,
    grounding_quality: groundingQualitySchema,
    thread_id: z.string(),
    turn_count: z.number(),
    ast_insights: astInsightsSchema,
  }),
  resumeSchema: z.object({
    action: z.enum(["continue", "done", "go_back"]),
    selected_path: z.string().optional(),
    reply: z.string().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const messages = [...inputData.messages];

    if (resumeData) {
      if (resumeData.action === "done") {
        const lastChallenge = await generateSocraticChallenge(inputData, messages);
        return {
          challenge: lastChallenge,
          conversation: messages,
          grounding_quality: inputData.grounding_quality,
          thread_id: inputData.thread_id,
          resource_id: inputData.resource_id,
          intent: inputData.intent,
          branch_name: inputData.branch_name,
          developer_id: inputData.developer_id,
          organization_id: inputData.organization_id,
          is_consensus: true,
          ast_insights: inputData.ast_insights,
          mode: inputData.mode,
        };
      }

      // Build the user reply from resume data
      let userReply = resumeData.reply ?? "";
      if (resumeData.selected_path) {
        userReply = `I choose: ${resumeData.selected_path}. ${userReply}`.trim();
      }
      if (userReply) {
        messages.push({ role: "user", content: userReply });
      }
    }

    const challenge = await generateSocraticChallenge(inputData, messages);
    messages.push({ role: "assistant", content: challenge.understanding });

    return await suspend({
      challenge,
      grounding_quality: inputData.grounding_quality,
      thread_id: inputData.thread_id,
      turn_count: messages.filter((m) => m.role === "assistant").length,
      ast_insights: inputData.ast_insights,
    });
  },
});

async function generateSocraticChallenge(
  data: z.infer<typeof afterAstSchema>,
  messages: z.infer<typeof messageSchema>[]
): Promise<z.infer<typeof socraticChallengeSchema>> {
  const dataWithMessages = { ...data, messages };
  const rawPrompt = buildSocraticPrompt(dataWithMessages);
  const persona = data.persona ?? "normal";
  const prompt = withPersonaPreamble(persona, rawPrompt);

  try {
    const agent = (await import("@/mastra")).mastra.getAgent("cliArchitectAgent");
    const result = await agent.generate([{ role: "user", content: prompt }], {
      structuredOutput: { schema: socraticChallengeSchema },
      memory: { resource: data.resource_id, thread: data.thread_id },
    });
    return result.object as z.infer<typeof socraticChallengeSchema>;
  } catch {
    // Fallback to direct Gemini generateObject
    try {
      const { object } = await generateObject({
        model: getPiCliGeminiModel("lite"),
        schema: socraticChallengeSchema,
        prompt: `${prompt}\n\nReturn JSON matching the schema. Do not write code.`,
      });
      return object;
    } catch (e2) {
      return {
        understanding: "Unable to generate challenge — model error.",
        missing_prerequisites: [],
        architectural_traps: [],
        alternative_paths: [],
        probing_question: "Can you rephrase your intent?",
        risks: [],
        invariants: [],
        claims: [],
        conflict_type: "none",
        files_likely_touched: [],
        is_ready: false,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Step 6: Commit Memory (ADR Persistence)
// ---------------------------------------------------------------------------

const debateOutputSchema = z.object({
  challenge: socraticChallengeSchema,
  conversation: z.array(messageSchema),
  grounding_quality: groundingQualitySchema,
  thread_id: z.string(),
  resource_id: z.string(),
  intent: z.string(),
  branch_name: z.string().optional(),
  developer_id: z.string().optional(),
  organization_id: z.string(),
  is_consensus: z.boolean(),
  ast_insights: astInsightsSchema,
  mode: z.enum(["explore", "challenge", "decision"]).optional(),
});

const afterMemorySchema = debateOutputSchema.extend({
  adr_saved: z.boolean(),
});

const commitMemoryStep = createStep({
  id: "commit-memory",
  inputSchema: debateOutputSchema,
  outputSchema: afterMemorySchema,
  execute: async ({ inputData }) => {
    let adrSaved = false;
    try {
      const mem = createPiCliMemory();
      if (mem && inputData.is_consensus) {
        const adrPayload = {
          type: "ADR",
          feature: inputData.intent,
          selected_path: inputData.challenge.alternative_paths.find(() => true)?.title ?? "consensus",
          rejected_options: inputData.challenge.alternative_paths.slice(1).map((p) => ({
            option: p.title,
            reason: p.tradeoffs,
          })),
          invariants: inputData.challenge.invariants,
          risks_acknowledged: inputData.challenge.risks,
          timestamp: Date.now(),
          files_likely_touched: inputData.challenge.files_likely_touched ?? [],
          conflict_type: inputData.challenge.conflict_type,
        };

        await mem.saveMessages({
          threadId: inputData.thread_id,
          messages: [
            {
              role: "assistant" as const,
              content: `[ADR] ${JSON.stringify(adrPayload)}`,
            },
          ],
        });
        adrSaved = true;
      }
    } catch (e) {
      console.warn("[cli-resonate-workflow] commit-memory failed:", e);
    }

    return { ...inputData, adr_saved: adrSaved };
  },
});

// ---------------------------------------------------------------------------
// Step 7: Generate Shadow Plan
// ---------------------------------------------------------------------------

const shadowPlanOutputSchema = afterMemorySchema.extend({
  shadow_plan_markdown: z.string(),
});

const generateShadowPlanStep = createStep({
  id: "generate-shadow-plan",
  inputSchema: afterMemorySchema,
  outputSchema: shadowPlanOutputSchema,
  execute: async ({ inputData }) => {
    const challenge = inputData.challenge;
    const day = new Date().toISOString().slice(0, 10);
    const prereqs = challenge.missing_prerequisites;
    const traps = challenge.architectural_traps;

    let stepNum = 0;
    const steps: string[] = [];

    if (prereqs.length > 0) {
      for (const p of prereqs) {
        stepNum++;
        steps.push(`## Step ${stepNum}: Prerequisite — ${p}
- **Action:** Implement or configure: ${p}
- **Validation:** Verify the prerequisite is satisfied before proceeding.
- **Command:** \`pi execute ${stepNum}\``);
      }
    }

    if (challenge.alternative_paths.length > 0) {
      const chosen = challenge.alternative_paths[0];
      stepNum++;
      steps.push(`## Step ${stepNum}: Core Implementation — ${chosen?.title ?? "Primary path"}
- **Action:** ${chosen?.description ?? "Implement the agreed-upon approach."}
- **Tradeoffs:** ${chosen?.tradeoffs ?? "N/A"}
- **Command:** \`pi execute ${stepNum}\``);
    }

    if (traps.length > 0) {
      stepNum++;
      steps.push(`## Step ${stepNum}: Guard Rails
- **Action:** Address architectural traps before shipping:
${traps.map((t) => `  - ${t}`).join("\n")}
- **Command:** \`pi execute ${stepNum}\``);
    }

    stepNum++;
    steps.push(`## Step ${stepNum}: Validation & Cleanup
- **Action:** Run \`pi validate\` against the changes. Verify all exit criteria.
- **Command:** \`pi execute ${stepNum}\``);

    const markdown = `# Architectural Plan: ${inputData.intent}
**Status:** Pending Execution
**Date:** ${day}
**Mode:** ${inputData.mode ?? "challenge"}
**Consensus:** ${inputData.is_consensus ? "Yes" : "No"}

## Context
${challenge.understanding}

## Invariants
${challenge.invariants.map((i) => `- ${i}`).join("\n") || "- (none)"}

## Risks Acknowledged
${challenge.risks.map((r) => `- ${r}`).join("\n") || "- (none)"}

${steps.join("\n\n")}

## Files Likely Touched
${(challenge.files_likely_touched ?? []).map((f) => `- ${f}`).join("\n") || "- (to be determined)"}

## Claims (cited)
${challenge.claims.map((c) => `- **${c.claim}** _(${c.source})_`).join("\n") || "- (none)"}
`;

    return { ...inputData, shadow_plan_markdown: markdown };
  },
});

// ---------------------------------------------------------------------------
// Assemble the Workflow
// ---------------------------------------------------------------------------

export const cliResonateWorkflow = createWorkflow({
  id: "cli-resonate-workflow",
  inputSchema: cliResonateWorkflowInputSchema,
  outputSchema: shadowPlanOutputSchema,
})
  .then(hydrateContextStep)
  .then(astAnalysisStep)
  .then(socraticDebateStep)
  .then(commitMemoryStep)
  .then(generateShadowPlanStep)
  .commit();
