import { createHash } from "node:crypto";

import { generateObject } from "ai";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { buildCliThreadId } from "@/lib/pi-cli-thread";
import { parsePiCliAsyncFlag } from "@/lib/pi-cli-async";
import {
  buildPiCliValidationCacheKey,
  getPiCliValidationCache,
  setPiCliValidationCache,
} from "@/lib/pi-cli-cache";
import { isPiCliWorkflowModeEnabled } from "@/lib/pi-cli-workflows";
import { isPiCliFailClosed } from "@/lib/pi-cli-fail-closed";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";
import { piCliMastra as mastra } from "@/lib/pi-cli-mastra";
import { readPersonaFromHeaders, withPersonaPreamble, type PiPersona } from "@/mastra/agents/_persona";

function shaShort(obj: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(obj ?? null))
    .digest("hex")
    .slice(0, 32);
}

const violationSchema = z.object({
  rule: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  suggestion: z.string().optional(),
});

const validateBodySchema = z
  .object({
    intent: z.string().max(2000).optional(),
    branch_name: z.string().max(256).optional(),
    developer_id: z.string().max(256).optional(),
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
  })
  .strict();

const semanticResponseSchema = z.object({
  semantic_violations: z.array(violationSchema),
  summary: z.string().optional(),
});

async function runLegacySemanticValidate(
  parsed: z.infer<typeof validateBodySchema>,
  persona: PiPersona,
) {
  const local = parsed.local_violations;
  let semantic: z.infer<typeof semanticResponseSchema> = { semantic_violations: [] };

  if (parsed.file_excerpts?.length || parsed.routine_markdown) {
    const model = getPiCliGeminiModel("lite");
    const { object } = await generateObject({
      model,
      schema: semanticResponseSchema,
      prompt: withPersonaPreamble(
        persona,
        `You are Pi's semantic validator. Given structural excerpts (may be redacted), list additional architecture / UX issues not covered by deterministic rules.

Intent: ${parsed.intent ?? "(none)"}

Routine (if any):
${(parsed.routine_markdown ?? "").slice(0, 24_000)}

Local deterministic violations already found (${local.length}):
${JSON.stringify(local, null, 2)}

File excerpts:
${(parsed.file_excerpts ?? [])
  .map((f) => `--- ${f.path}\n${f.excerpt}`)
  .join("\n\n")
  .slice(0, 48_000)}

Return semantic_violations only for high-signal issues; avoid duplicating deterministic findings.`,
      ),
    });
    semantic = object;
  }

  return semantic;
}

/**
 * pi validate — merge local deterministic results with optional semantic checks (Mastra workflow or legacy Gemini).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = validateBodySchema.safeParse(body);
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
  const local = parsed.data.local_violations;
  const organizationId = request.organizationId;
  const threadId = buildCliThreadId({
    organizationId,
    branchName: parsed.data.branch_name ?? "default",
    developerId: parsed.data.developer_id,
  });

  const cacheKey = buildPiCliValidationCacheKey({
    organizationId,
    intent: parsed.data.intent,
    routineHash: shaShort(parsed.data.routine_markdown ?? ""),
    excerptsHash: shaShort(parsed.data.file_excerpts ?? []),
    localHash: shaShort(local),
  });

  const cached = await getPiCliValidationCache(cacheKey);
  if (cached && typeof cached === "object" && cached !== null && "semantic_violations" in cached) {
    const res = apiSuccessEnvelope({
      data: cached as Record<string, unknown>,
      object: "pi_cli_validate",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    res.headers.set("X-Pi-Cache", "hit");
    return res;
  }

  const inputData = {
    organization_id: organizationId,
    thread_id: threadId,
    intent: parsed.data.intent,
    local_violations: local,
    routine_markdown: parsed.data.routine_markdown,
    file_excerpts: parsed.data.file_excerpts,
    persona,
  };

  const workflowEnabled = isPiCliWorkflowModeEnabled();
  const asyncRequested = parsePiCliAsyncFlag(request);
  const strict = isPiCliFailClosed(request);

  if (strict && asyncRequested && !workflowEnabled) {
    return apiError(
      "workflow_disabled",
      "Pi CLI workflow mode is not enabled on this server. Set PI_CLI_USE_WORKFLOWS=true and configure PI_CLI_DATABASE_URL, or retry with X-Pi-Fail-Closed: false.",
      503,
      requestId,
      "api_error",
      { workflow_key: "cliValidateWorkflow", phase: "async" },
    );
  }

  if (workflowEnabled && asyncRequested) {
    try {
      const wf = mastra.getWorkflow("cliValidateWorkflow");
      const run = await wf.createRun({ resourceId: organizationId });
      const handle = await tasks.trigger("cli-workflow-runner", {
        workflow_key: "cliValidateWorkflow",
        organization_id: organizationId,
        mastra_run_id: run.runId,
        input_data: inputData as Record<string, unknown>,
      });
      const res = apiSuccessEnvelope({
        data: {
          async: true,
          run_id: run.runId,
          workflow_key: "cliValidateWorkflow",
          trigger_job_id: handle.id,
          thread_id: threadId,
        },
        object: "pi_cli_validate",
        requestId,
        status: "accepted",
        httpStatus: 202,
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    } catch (e) {
      console.warn("[pi-cli/validate] async_trigger_failed", e);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          "Async workflow dispatch failed. Retry later or disable strict mode via X-Pi-Fail-Closed: false.",
          503,
          requestId,
          "api_error",
          {
            workflow_key: "cliValidateWorkflow",
            phase: "async",
            reason: e instanceof Error ? e.message : "trigger_failed",
          },
        );
      }
    }
  }

  if (workflowEnabled) {
    try {
      const wf = mastra.getWorkflow("cliValidateWorkflow");
      const run = await wf.createRun({ resourceId: organizationId });
      const result = await run.start({
        inputData,
      });

      if (result.status === "success") {
        const out = result.result as {
          semantic_violations: z.infer<typeof violationSchema>[];
          summary?: string;
          adaptive_recommended?: boolean;
        };
        const payload = {
          local_violations: local,
          semantic_violations: out.semantic_violations,
          summary: out.summary ?? null,
          adaptive_recommended: out.adaptive_recommended ?? false,
          thread_id: threadId,
          workflow: "cliValidateWorkflow",
        };
        await setPiCliValidationCache(cacheKey, payload);
        const res = apiSuccessEnvelope({
          data: payload,
          object: "pi_cli_validate",
          requestId,
          status: "completed",
          httpStatus: 200,
        });
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      console.warn("[pi-cli/validate] workflow_non_success", result.status);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          `Pi CLI validate workflow terminated with status "${result.status}" instead of "success".`,
          503,
          requestId,
          "api_error",
          { workflow_key: "cliValidateWorkflow", phase: "sync", status: result.status },
        );
      }
    } catch (e) {
      console.warn("[pi-cli/validate] workflow_failed_fallback", e);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          "Pi CLI validate workflow execution failed.",
          503,
          requestId,
          "api_error",
          {
            workflow_key: "cliValidateWorkflow",
            phase: "sync",
            reason: e instanceof Error ? e.message : "workflow_failed",
          },
        );
      }
    }
  } else if (strict) {
    return apiError(
      "workflow_disabled",
      "Pi CLI workflow mode is not enabled on this server. Set PI_CLI_USE_WORKFLOWS=true and configure PI_CLI_DATABASE_URL.",
      503,
      requestId,
      "api_error",
      { workflow_key: "cliValidateWorkflow", phase: "sync" },
    );
  }

  let semantic: z.infer<typeof semanticResponseSchema> = { semantic_violations: [] };
  try {
    semantic = await runLegacySemanticValidate(parsed.data, persona);
  } catch (e) {
    console.warn("[pi-cli/validate] semantic_optional_failed", e);
  }

  const legacyPayload = {
    local_violations: local,
    semantic_violations: semantic.semantic_violations,
    summary: semantic.summary ?? null,
    thread_id: threadId,
    workflow: null,
  };
  await setPiCliValidationCache(cacheKey, legacyPayload);

  const res = apiSuccessEnvelope({
    data: legacyPayload,
    object: "pi_cli_validate",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
});
