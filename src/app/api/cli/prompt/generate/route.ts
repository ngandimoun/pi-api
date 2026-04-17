import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { buildCliThreadId } from "@/lib/pi-cli-thread";
import { compilePiPromptDraft } from "@/lib/pi-cli-prompt-compile";
import {
  gatherRoutineContext,
  routineContextPayloadSchema,
  type GatheredRoutineContext,
} from "@/lib/pi-cli-routine-context";

function deriveContextQuality(gathered: GatheredRoutineContext): "rich" | "partial" | "thin" {
  const hasGraph = !gathered.graph_summary.startsWith("(no import graph");
  const hasMemory =
    Boolean(gathered.memory_context?.trim()) &&
    !gathered.memory_context.startsWith("(memory recall skipped");
  const hasStyle = !gathered.system_style_summary.startsWith("(no system_style");
  const score = [hasGraph, hasMemory, hasStyle].filter(Boolean).length;
  if (score === 3) return "rich";
  if (score >= 1) return "partial";
  return "thin";
}

function extractMemoryHighlight(memoryContext: string): string | undefined {
  const lines = memoryContext
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && l.length < 220);
  return lines[0];
}

const promptBodySchema = z
  .object({
    intent: z.string().min(3).max(4000),
    system_style: z.record(z.unknown()).optional(),
    branch_name: z.string().max(256).optional(),
    developer_id: z.string().max(256).optional(),
    routine_context: routineContextPayloadSchema.optional(),
  })
  .strict();

/**
 * pi prompt — compile a codebase-aware prompt for Cursor / Claude Code / Windsurf.
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = promptBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid body.",
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

  try {
    const gathered = await gatherRoutineContext({
      organization_id: request.organizationId,
      thread_id: threadId,
      intent: parsed.data.intent,
      system_style: parsed.data.system_style,
      routine_context: parsed.data.routine_context,
    });

    const context_quality = deriveContextQuality(gathered);
    const memory_highlight = extractMemoryHighlight(gathered.memory_context);

    const result = await compilePiPromptDraft({
      intent: parsed.data.intent,
      system_style_summary: gathered.system_style_summary,
      graph_summary: gathered.graph_summary,
      ast_summaries: gathered.ast_summaries,
      memory_context: gathered.memory_context,
      import_histogram_note: gathered.import_histogram_note,
      framework_hints_note: gathered.framework_hints_note,
    });

    const res = apiSuccessEnvelope({
      data: {
        compiled_prompt: result.compiled_prompt,
        intent_slug: result.intent_slug,
        thread_id: threadId,
        context_quality,
        memory_highlight,
      },
      object: "pi_cli_prompt",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Prompt compilation failed.";
    return apiError("prompt_compile_failed", message, 500, requestId, "api_error");
  }
});
