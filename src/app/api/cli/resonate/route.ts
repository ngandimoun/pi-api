import { generateObject } from "ai";
import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import {
  canPersistTeamSystemStyle,
  getPiCliGovernanceMode,
  insertResonateDraft,
  logPiCliGovernanceAction,
  resolvePiCliRole,
} from "@/lib/pi-cli-governance";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";
import { buildDeterministicFacts } from "@/lib/pi-cli-resonate-deterministic";
import { gatherRoutineContext, routineContextPayloadSchema } from "@/lib/pi-cli-routine-context";
import type { GatheredRoutineContext } from "@/lib/pi-cli-routine-context";
import { buildCliResourceId, buildCliThreadId } from "@/lib/pi-cli-thread";
import { isPiCliWorkflowModeEnabled } from "@/lib/pi-cli-workflows";
import { isPiCliFailClosed } from "@/lib/pi-cli-fail-closed";
import { piCliMastraResonate as mastra } from "@/lib/pi-cli-mastra-resonate";
import { readPersonaFromHeaders, withPersonaPreamble } from "@/mastra/agents/_persona";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(32_000),
});

const validateContextSchema = z.object({
  violations: z.array(z.string()).max(500),
  routine_slug: z.string().max(256).optional(),
});

const resonateBodySchema = z
  .object({
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
    validate_context: validateContextSchema.optional(),
    /** When set, junior devs queue a team-wide system-style proposal (requires tech_lead approval in strict governance). */
    propose_team_system_style: z.record(z.unknown()).optional(),
  })
  .strict();

const recommendedApproachSchema = z.object({
  label: z.enum(["A", "B", "none"]),
  rationale: z.string(),
});

const groundingQualitySchema = z.object({
  graph_available: z.boolean(),
  style_available: z.boolean(),
  excerpts_count: z.number(),
  constitution_loaded: z.boolean(),
});

const claimEvidenceSchema = z.enum([
  "graph",
  "system_style",
  "ast",
  "diff",
  "constitution",
  "validation",
  "memory",
  "inference",
]);

/** LLM structured output (grounding_quality overwritten server-side). */
const resonateAgentOutputSchema = z.object({
  message: z.string(),
  tradeoffs: z.array(z.string()).max(24),
  risks: z.array(z.string()).max(16),
  invariants: z.array(z.string()).max(16),
  open_questions: z.array(z.string()).max(16),
  suggested_alternatives: z.array(z.string()).max(24),
  recommended_approach: recommendedApproachSchema,
  exit_criteria: z.array(z.string()).max(16),
  claims: z
    .array(
      z.object({
        claim: z.string(),
        source: z.string(),
        evidence_type: claimEvidenceSchema.optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .max(24),
  conflict_type: z.enum(["hard_constraint", "pattern_divergence", "preference", "none"]),
  files_likely_touched: z.array(z.string()).max(80).optional(),
  grounding_quality: groundingQualitySchema.optional(),
  is_ready: z.boolean(),
  /** Optional — server derives if omitted. */
  session_status: z.enum(["question", "building", "resolved"]).optional(),
  /** Optional — server derives if omitted. */
  next_action: z.enum(["reply", "approve", "execute", "done"]).optional(),
});

function deriveResonateSessionState(obj: z.infer<typeof resonateAgentOutputSchema>): {
  session_status: "question" | "building" | "resolved";
  next_action: "reply" | "approve" | "execute" | "done";
} {
  const allowedNext = new Set(["reply", "approve", "execute", "done"]);
  const allowedStatus = new Set(["question", "building", "resolved"]);

  let session_status = obj.session_status;
  let next_action = obj.next_action;

  if (!session_status || !allowedStatus.has(session_status)) {
    const open = obj.open_questions.length > 0;
    if (obj.is_ready && !open && obj.conflict_type !== "hard_constraint") {
      session_status = "building";
    } else {
      session_status = "question";
    }
  }

  if (!next_action || !allowedNext.has(next_action)) {
    if (session_status === "resolved") {
      next_action = "done";
    } else if (session_status === "building" && obj.is_ready) {
      next_action = "approve";
    } else {
      next_action = "reply";
    }
  }

  if (session_status === "resolved" && next_action !== "done") {
    next_action = "done";
  }

  return {
    session_status: session_status as "question" | "building" | "resolved",
    next_action: next_action as "reply" | "approve" | "execute" | "done",
  };
}

function formatConversation(messages: z.infer<typeof messageSchema>[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Pi"}: ${m.content}`)
    .join("\n\n");
}

function modeBlock(mode: "explore" | "challenge" | "decision" | undefined): string {
  const m = mode ?? "challenge";
  if (m === "explore") {
    return `## Session mode: EXPLORE
Ask broad questions. Map the design space. Do not force convergence or is_ready=true until the user signals they want to commit to a direction.`;
  }
  if (m === "decision") {
    return `## Session mode: DECISION
Force a concrete A/B (or A/B/n) choice when two plausible architectures exist. Resolve or explicitly defer each open_question before setting is_ready=true.`;
  }
  return `## Session mode: CHALLENGE
Dispute weak premises. Every turn must surface at least one risk, tradeoff, or conflict with repo evidence. Prefer useful friction over agreeableness.`;
}

function applyDepthToGathered(
  gathered: GatheredRoutineContext,
  depth: "fast" | "deep" | undefined
): GatheredRoutineContext {
  if (depth !== "fast") return gathered;
  return {
    ...gathered,
    ast_summaries: "(skipped in fast depth — CLI can use --deep for AST/excerpt analysis.)",
    graph_summary: gathered.graph_summary.slice(0, 2000) + (gathered.graph_summary.length > 2000 ? "…" : ""),
  };
}

function computeGroundingQuality(params: {
  gathered: GatheredRoutineContext;
  constitution?: string;
  excerptCount: number;
}): z.infer<typeof groundingQualitySchema> {
  const { gathered, constitution, excerptCount } = params;
  return {
    graph_available: !gathered.graph_summary.trim().startsWith("(no import graph"),
    style_available: !gathered.system_style_summary.trim().startsWith("(no system_style"),
    excerpts_count: excerptCount,
    constitution_loaded: Boolean(constitution?.trim()),
  };
}

function buildResonatePrompt(params: {
  organizationId: string;
  intent: string;
  gathered: GatheredRoutineContext;
  systemStyleJson: string;
  messages: z.infer<typeof messageSchema>[];
  mode?: "explore" | "challenge" | "decision";
  constitution?: string;
  gitDiffSummary?: string;
  validateContext?: z.infer<typeof validateContextSchema>;
  deterministicFacts: string;
}): string {
  const {
    organizationId,
    intent,
    gathered,
    systemStyleJson,
    messages,
    mode,
    constitution,
    gitDiffSummary,
    validateContext,
    deterministicFacts,
  } = params;

  const valBlock =
    validateContext?.violations?.length ?
      `## Prior validation violations (from pi validate — address or explain)
${validateContext.violations.slice(0, 80).map((v, i) => `${i + 1}. ${v}`).join("\n")}
${validateContext.routine_slug ? `(routine context: ${validateContext.routine_slug})` : ""}
`
      : "";

  const constBlock =
    constitution?.trim() ?
      `## HARD CONSTRAINTS (non-negotiable — from .pi/constitution.md)
${constitution.trim().slice(0, 50_000)}
`
      : "";

  const diffBlock =
    gitDiffSummary?.trim() ?
      `## What you are currently building (staged / working tree — highest priority)
${gitDiffSummary.trim().slice(0, 90_000)}
`
      : "";

  return `${modeBlock(mode)}

## Session metadata
organization_id (required for query-dependency-graph tool): "${organizationId}"
Original feature intent: ${intent}

${constBlock}
${diffBlock}
${valBlock}
## MUST-RECONCILE FACTS (deterministic — cite these in claims[] when you rely on them)
${deterministicFacts}

## system_style JSON (pass as system_style_json to query-system-style when needed)
${systemStyleJson.slice(0, 100_000)}

## Pi repo signals (grounding)
### Memory / prior Pi context
${gathered.memory_context.slice(0, 8000)}

### Import graph summary
${gathered.graph_summary.slice(0, 12_000)}

### AST / excerpt hints
${gathered.ast_summaries.slice(0, 12_000)}

### System style summary
${gathered.system_style_summary.slice(0, 8000)}

### Existing routines note
${gathered.existing_routines_note.slice(0, 6000)}

### Import / framework hints
${gathered.import_histogram_note.slice(0, 4000)}
${gathered.framework_hints_note.slice(0, 4000)}

### Relevant routines
${JSON.stringify(gathered.relevant_routines ?? [], null, 0).slice(0, 8000)}

## Conversation (respond to the latest User turn)
${formatConversation(messages)}

## Structured output rules
- Populate claims[] with { claim, source, evidence_type?, confidence? }. Map source strings to evidence_type when possible: graph | system_style | ast | diff | constitution | validation | memory | inference.
- confidence: 0–1 (1 = verified by tools or constitution; lower for inference or thin context).
- source remains a short human-readable label (e.g. "from graph").
- Set conflict_type: hard_constraint if violating constitution or repo invariant; pattern_divergence if diverging from existing patterns; preference for product/taste; none if N/A.
- Set grounding_quality in output (will be reconciled server-side).
- session_status (optional): question = still clarifying; building = architecture agreed and ready to hand off to implementation; resolved = user has explicitly closed the design discussion in the latest turn.
- next_action (optional): reply = need another user message; approve = show consensus and wait for user confirmation; execute = ready for build steps; done = conversation finished, client may exit without another prompt.
- Do NOT write code. Reference paths in plain text only.
`;
}

/**
 * pi resonate — interactive staff-engineer architecture session (no code generation).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = resonateBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid body.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  const persona = readPersonaFromHeaders(request.headers);

  const last = parsed.data.messages[parsed.data.messages.length - 1];
  if (last?.role !== "user") {
    return apiError(
      "invalid_body",
      "Last message must be from the user.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  const threadId = buildCliThreadId({
    organizationId: request.organizationId,
    branchName: parsed.data.branch_name ?? "default",
    developerId: parsed.data.developer_id,
  });

  const resource = buildCliResourceId(request.organizationId);

  const proposeStyle = parsed.data.propose_team_system_style;
  if (
    proposeStyle &&
    Object.keys(proposeStyle).length > 0 &&
    getPiCliGovernanceMode() !== "disabled"
  ) {
    const role = await resolvePiCliRole(request.organizationId, request.developerId);
    if (!canPersistTeamSystemStyle(role)) {
      const draftId = `draft_${crypto.randomUUID()}`;
      const inserted = await insertResonateDraft({
        id: draftId,
        organizationId: request.organizationId,
        developerId: request.developerId,
        proposedSystemStyle: proposeStyle,
        summary: parsed.data.intent.slice(0, 240),
      });
      if (inserted) {
        await logPiCliGovernanceAction({
          organizationId: request.organizationId,
          developerId: request.developerId,
          action: "resonate_draft_created",
          details: { draft_id: draftId },
        });
        const res = apiSuccessEnvelope({
          data: {
            status: "pending_approval",
            draft_id: draftId,
            message:
              "Proposal saved for tech lead approval. They can run `pi resonate approve <draft_id>` to publish the team system-style.",
            thread_id: threadId,
          },
          object: "pi_cli_resonate",
          requestId,
          status: "pending_approval",
          httpStatus: 200,
        });
        res.headers.set("X-Request-Id", requestId);
        return res;
      }
    }
  }

  // ---------- Workflow mode (Socratic Loop state machine) ----------
  const url = new URL(request.url);
  const workflowRequested = url.searchParams.get("workflow") === "true";
  const workflowEnabled = isPiCliWorkflowModeEnabled();
  const strict = isPiCliFailClosed(request);

  if (workflowRequested && strict && !workflowEnabled) {
    return apiError(
      "workflow_disabled",
      "Pi CLI resonate workflow mode is not enabled on this server. Set PI_CLI_USE_WORKFLOWS=true and configure PI_CLI_DATABASE_URL, or retry with X-Pi-Fail-Closed: false.",
      503,
      requestId,
      "api_error",
      { workflow_key: "cliResonateWorkflow", phase: "sync" },
    );
  }

  if (workflowRequested && workflowEnabled) {
    try {
      const wf = mastra.getWorkflow("cliResonateWorkflow");
      const run = await wf.createRun({ resourceId: request.organizationId });

      const wfInput = {
        organization_id: request.organizationId,
        intent: parsed.data.intent,
        messages: parsed.data.messages,
        branch_name: parsed.data.branch_name,
        developer_id: parsed.data.developer_id,
        system_style: parsed.data.system_style,
        routine_context: parsed.data.routine_context,
        mode: parsed.data.mode,
        depth: parsed.data.depth,
        constitution: parsed.data.constitution,
        git_diff_summary: parsed.data.git_diff_summary,
        persona,
      };

      const result = await run.start({ inputData: wfInput });

      if (result.status === "suspended") {
        const suspendPayload = (result as Record<string, unknown>).suspendedSteps ??
          (result as Record<string, unknown>).suspend_payload ??
          result;
        const res = apiSuccessEnvelope({
          data: {
            workflow: true,
            run_id: run.runId,
            status: "suspended",
            suspend_payload: suspendPayload,
            thread_id: threadId,
          },
          object: "pi_cli_resonate",
          requestId,
          status: "suspended",
          httpStatus: 200,
        });
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      if (result.status === "success") {
        const out = result.result as Record<string, unknown>;
        const res = apiSuccessEnvelope({
          data: {
            workflow: true,
            run_id: run.runId,
            status: "completed",
            ...out,
            thread_id: threadId,
          },
          object: "pi_cli_resonate",
          requestId,
          status: "completed",
          httpStatus: 200,
        });
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      console.warn("[pi-cli/resonate] workflow_non_terminal", result.status);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          `Pi CLI resonate workflow terminated with status "${result.status}" instead of "success" or "suspended".`,
          503,
          requestId,
          "api_error",
          { workflow_key: "cliResonateWorkflow", phase: "sync", status: result.status },
        );
      }
    } catch (e) {
      console.warn("[pi-cli/resonate] workflow_failed_fallback_to_agent", e);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          "Pi CLI resonate workflow execution failed.",
          503,
          requestId,
          "api_error",
          {
            workflow_key: "cliResonateWorkflow",
            phase: "sync",
            reason: e instanceof Error ? e.message : "workflow_failed",
          },
        );
      }
    }
  }

  // ---------- Legacy agent mode (stateless) ----------
  try {
    const gatheredRaw = await gatherRoutineContext({
      organization_id: request.organizationId,
      thread_id: threadId,
      intent: parsed.data.intent,
      system_style: parsed.data.system_style,
      routine_context: parsed.data.routine_context,
    });

    const depth: "fast" | "deep" = parsed.data.depth ?? "fast";
    const gathered = applyDepthToGathered(gatheredRaw, depth);

    const systemStyleJson = JSON.stringify(parsed.data.system_style ?? {}, null, 0);

    const deterministicFacts = buildDeterministicFacts({
      gathered,
      gitDiffSummary: parsed.data.git_diff_summary,
    });

    const excerptCount = parsed.data.routine_context?.file_excerpts?.length ?? 0;

    const userContent = withPersonaPreamble(
      persona,
      buildResonatePrompt({
        organizationId: request.organizationId,
        intent: parsed.data.intent,
        gathered,
        systemStyleJson,
        messages: parsed.data.messages,
        mode: parsed.data.mode,
        constitution: parsed.data.constitution,
        gitDiffSummary: parsed.data.git_diff_summary,
        validateContext: parsed.data.validate_context,
        deterministicFacts,
      }),
    );

    const agent = mastra.getAgent("cliResonateAgent");

    const grounding_quality = computeGroundingQuality({
      gathered: gatheredRaw,
      constitution: parsed.data.constitution,
      excerptCount,
    });

    const mergeResponse = (obj: z.infer<typeof resonateAgentOutputSchema>) => {
      const { session_status, next_action } = deriveResonateSessionState(obj);
      return {
        message: obj.message,
        tradeoffs: obj.tradeoffs,
        risks: obj.risks,
        invariants: obj.invariants,
        open_questions: obj.open_questions,
        suggested_alternatives: obj.suggested_alternatives,
        recommended_approach: obj.recommended_approach,
        exit_criteria: obj.exit_criteria,
        claims: obj.claims,
        conflict_type: obj.conflict_type,
        files_likely_touched: obj.files_likely_touched,
        grounding_quality,
        is_ready: obj.is_ready,
        thread_id: threadId,
        session_status,
        next_action,
      };
    };

    try {
      const result = await agent.generate([{ role: "user", content: userContent }], {
        structuredOutput: { schema: resonateAgentOutputSchema },
        memory: { resource, thread: threadId },
      });

      const obj = result.object as z.infer<typeof resonateAgentOutputSchema>;
      const res = apiSuccessEnvelope({
        data: mergeResponse(obj),
        object: "pi_cli_resonate",
        requestId,
        status: "completed",
        httpStatus: 200,
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    } catch (e) {
      console.warn("[pi-cli/resonate] agent_generate_failed", e);
      try {
        const { object } = await generateObject({
          model: getPiCliGeminiModel("lite"),
          schema: resonateAgentOutputSchema,
          prompt: `${userContent}

You must output JSON matching the schema. Do not write code.`,
        });
        const res = apiSuccessEnvelope({
          data: mergeResponse(object),
          object: "pi_cli_resonate",
          requestId,
          status: "completed",
          httpStatus: 200,
        });
        res.headers.set("X-Request-Id", requestId);
        return res;
      } catch (e2) {
        console.warn("[pi-cli/resonate] fallback_generate_failed", e2);
        const msg =
          e2 instanceof Error ? e2.message : e instanceof Error ? e.message : "Resonate model failure.";
        return apiError("resonate_failed", msg, 500, requestId, "api_error");
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Resonate failed.";
    return apiError("resonate_failed", message, 500, requestId, "api_error");
  }
});
