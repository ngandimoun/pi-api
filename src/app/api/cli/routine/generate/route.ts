import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { buildCliThreadId } from "@/lib/pi-cli-thread";
import { parsePiCliAsyncFlag } from "@/lib/pi-cli-async";
import { getMastraPostgresStore } from "@/lib/mastra-storage";
import { isPiCliFailClosed } from "@/lib/pi-cli-fail-closed";
import { isPiCliRoutineHitlEnabled } from "@/lib/pi-cli-workflows";
import { scrapeBrandingProfile } from "@/lib/firecrawl";
import { gatherRoutineContext, routineContextPayloadSchema } from "@/lib/pi-cli-routine-context";
import { generatePiRoutineDraft } from "@/lib/pi-cli-routine-generate";
import { buildRoutineAdapterOutputs, type RoutineFormatId } from "@/lib/pi-cli-routine-adapters-output";
import { EMBEDDED_ROUTINE_TEMPLATES } from "../../../../../../packages/pi-cli/src/lib/embedded-templates";
import { scoreEmbeddedTemplates } from "../../../../../../packages/pi-cli/src/lib/routine-template-suggest";
import { mastra } from "@/mastra";
import { tasks } from "@trigger.dev/sdk/v3";

const formatEnum = z.enum(["cursor", "claude", "windsurf"]);

const routineBodySchema = z
  .object({
    intent: z.string().min(3).max(4000),
    system_style: z.record(z.unknown()).optional(),
    doc_urls: z.array(z.string().url()).max(5).optional(),
    require_approval: z.boolean().optional(),
    branch_name: z.string().max(256).optional(),
    developer_id: z.string().max(256).optional(),
    routine_context: routineContextPayloadSchema.optional(),
    format: z.array(formatEnum).max(5).optional(),
  })
  .strict();

/**
 * pi routine — generate structured routine spec (Markdown + optional agent adapter text).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = routineBodySchema.safeParse(body);
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

  const requireApproval = Boolean(parsed.data.require_approval);

  const routineInput = {
    organization_id: request.organizationId,
    thread_id: threadId,
    intent: parsed.data.intent,
    system_style: parsed.data.system_style,
    doc_urls: parsed.data.doc_urls,
    require_approval: requireApproval,
    routine_context: parsed.data.routine_context,
  };

  const formats = (parsed.data.format ?? []) as RoutineFormatId[];

  const hitlEnabled = isPiCliRoutineHitlEnabled() && Boolean(getMastraPostgresStore());
  const asyncRequested = parsePiCliAsyncFlag(request);
  const strict = isPiCliFailClosed(request);

  if (requireApproval && strict && !hitlEnabled) {
    return apiError(
      "workflow_disabled",
      "Pi CLI routine HITL suspend/resume is not enabled on this server. Set PI_CLI_ROUTINE_HITL=true and configure PI_CLI_DATABASE_URL, or retry with X-Pi-Fail-Closed: false.",
      503,
      requestId,
      "api_error",
      { workflow_key: "cliRoutineWorkflow", phase: requireApproval && asyncRequested ? "async" : "sync" },
    );
  }

  if (hitlEnabled && requireApproval && asyncRequested) {
    try {
      const wf = mastra.getWorkflow("cliRoutineWorkflow");
      const run = await wf.createRun({ resourceId: request.organizationId });
      const handle = await tasks.trigger("cli-workflow-runner", {
        workflow_key: "cliRoutineWorkflow",
        organization_id: request.organizationId,
        mastra_run_id: run.runId,
        input_data: routineInput as Record<string, unknown>,
      });
      const res = apiSuccessEnvelope({
        data: {
          async: true,
          run_id: run.runId,
          workflow_key: "cliRoutineWorkflow",
          trigger_job_id: handle.id,
          thread_id: threadId,
          status: "queued",
          format: formats,
        },
        object: "pi_cli_routine",
        requestId,
        status: "accepted",
        httpStatus: 202,
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    } catch (e) {
      console.warn("[pi-cli/routine] async_trigger_failed", e);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          "Async routine workflow dispatch failed. Retry later or disable strict mode via X-Pi-Fail-Closed: false.",
          503,
          requestId,
          "api_error",
          {
            workflow_key: "cliRoutineWorkflow",
            phase: "async",
            reason: e instanceof Error ? e.message : "trigger_failed",
          },
        );
      }
    }
  }

  if (hitlEnabled && requireApproval) {
    try {
      const wf = mastra.getWorkflow("cliRoutineWorkflow");
      const run = await wf.createRun({ resourceId: request.organizationId });
      const result = await run.start({
        inputData: routineInput,
      });

      if (result.status === "suspended") {
        const res = apiSuccessEnvelope({
          data: {
            status: "suspended",
            run_id: run.runId,
            workflow_key: "cliRoutineWorkflow",
            suspend_payload: result.suspendPayload,
            suspended: result.suspended,
            thread_id: threadId,
            format: formats,
          },
          object: "pi_cli_routine",
          requestId,
          status: "completed",
          httpStatus: 200,
        });
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      if (result.status === "success") {
        const out = result.result as {
          slug: string;
          markdown: string;
          version: number;
          routine_spec_json?: string;
          execution_plan_markdown?: string;
          execution_plan_slug?: string;
        };
        const adapter_outputs = buildRoutineAdapterOutputs(out.routine_spec_json, formats);
        const res = apiSuccessEnvelope({
          data: {
            slug: out.slug,
            markdown: out.markdown,
            version: out.version,
            status: "completed",
            run_id: run.runId,
            workflow_key: "cliRoutineWorkflow",
            thread_id: threadId,
            routine_spec_json: out.routine_spec_json,
            execution_plan_markdown: out.execution_plan_markdown,
            execution_plan_slug: out.execution_plan_slug,
            adapter_outputs,
          },
          object: "pi_cli_routine",
          requestId,
          status: "completed",
          httpStatus: 200,
        });
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      console.warn("[pi-cli/routine] workflow_non_success", result.status);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          `Pi CLI routine workflow terminated with status "${result.status}" instead of "success".`,
          503,
          requestId,
          "api_error",
          { workflow_key: "cliRoutineWorkflow", phase: "sync", status: result.status },
        );
      }
    } catch (e) {
      console.warn("[pi-cli/routine] workflow_failed_fallback", e);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          "Pi CLI routine workflow execution failed.",
          503,
          requestId,
          "api_error",
          {
            workflow_key: "cliRoutineWorkflow",
            phase: "sync",
            reason: e instanceof Error ? e.message : "workflow_failed",
          },
        );
      }
    }
  }

  const docSnippets: string[] = [];
  const urls = parsed.data.doc_urls ?? [];
  for (const url of urls) {
    try {
      const scraped = await scrapeBrandingProfile(url);
      docSnippets.push(`### ${url}\n${scraped.markdown.slice(0, 12_000)}`);
    } catch (e) {
      docSnippets.push(`### ${url}\n(failed to scrape: ${e instanceof Error ? e.message : "error"})`);
    }
  }

  // Server-side: inject top-N matched embedded template routine_spec JSON for LLM synthesis
  try {
    const topTemplateIds = scoreEmbeddedTemplates(parsed.data.intent, EMBEDDED_ROUTINE_TEMPLATES, 3);

    for (const templateId of topTemplateIds) {
      const template = EMBEDDED_ROUTINE_TEMPLATES.find((t) => t.id === templateId);
      if (template?.routine_spec) {
        const compactSpec = JSON.stringify(template.routine_spec).slice(0, 3000);
        docSnippets.push(`### Embedded reference: ${template.name}\n\`\`\`json\n${compactSpec}\n\`\`\``);
      }
    }
  } catch (e) {
    console.warn("[routine/generate] Failed to inject embedded templates:", e instanceof Error ? e.message : "unknown");
  }

  try {
    const gathered = await gatherRoutineContext({
      organization_id: request.organizationId,
      thread_id: threadId,
      intent: parsed.data.intent,
      system_style: parsed.data.system_style,
      routine_context: parsed.data.routine_context,
    });

    const draft = await generatePiRoutineDraft({
      intent: parsed.data.intent,
      doc_snippets: docSnippets,
      system_style_summary: gathered.system_style_summary,
      import_histogram_note: gathered.import_histogram_note,
      framework_hints_note: gathered.framework_hints_note,
      graph_summary: gathered.graph_summary,
      ast_summaries: gathered.ast_summaries,
      memory_context: gathered.memory_context,
      existing_routines_note: gathered.existing_routines_note,
      relevant_routines: gathered.relevant_routines,
    });

    const adapter_outputs = buildRoutineAdapterOutputs(draft.routine_spec_json, formats);

    const res = apiSuccessEnvelope({
      data: {
        slug: draft.slug,
        markdown: draft.markdown,
        version: 1,
        status: "completed",
        workflow_key: null,
        thread_id: threadId,
        routine_spec_json: draft.routine_spec_json,
        execution_plan_markdown: draft.execution_plan_markdown,
        execution_plan_slug: draft.execution_plan_slug,
        adapter_outputs,
      },
      object: "pi_cli_routine",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Routine generation failed.";
    return apiError("routine_failed", message, 500, requestId, "api_error");
  }
});
