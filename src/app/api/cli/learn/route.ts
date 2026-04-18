import { generateObject } from "ai";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { parsePiCliAsyncFlag } from "@/lib/pi-cli-async";
import {
  canPersistTeamSystemStyle,
  getPiCliGovernanceMode,
  logPiCliGovernanceAction,
  resolvePiCliRole,
} from "@/lib/pi-cli-governance";
import { isPiCliWorkflowModeEnabled } from "@/lib/pi-cli-workflows";
import { isPiCliFailClosed } from "@/lib/pi-cli-fail-closed";
import { getPiCliGeminiModel } from "@/lib/pi-cli-llm";
import { uploadLatestPiSystemStyle } from "@/lib/pi-cli-r2";
import { mastra } from "@/mastra";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const learnBodySchema = z
  .object({
    metadata: z.object({
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
      governance_sources: z
        .array(z.string().max(50_000))
        .max(20)
        .optional(),
    }),
  })
  .strict();

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
  templates: z.object({
    hash: z.string(),
    version: z.string(),
    count: z.number(),
  }).optional(),
  governance: z.object({
    rationale: z.array(z.string()),
    adrs: z.array(z.string()),
    constraints: z.array(z.string()),
  }).optional(),
});

async function hashCliTemplates(): Promise<{ hash: string; version: string; count: number }> {
  try {
    const templatesDir = path.join(process.cwd(), "packages/pi-cli/src/templates");
    const files = await fs.readdir(templatesDir, { recursive: true, withFileTypes: true });
    const jsonFiles = files
      .filter((f) => f.isFile() && f.name.endsWith(".json"))
      .map((f) => path.join(f.parentPath || f.path, f.name))
      .sort();

    const contents: string[] = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(file, "utf8");
        contents.push(content);
      } catch {
        // Skip unreadable files
      }
    }

    const concatenated = contents.join("\n");
    const hash = createHash("sha256").update(concatenated).digest("hex").slice(0, 16);
    const version = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    return { hash, version, count: contents.length };
  } catch {
    return { hash: "unknown", version: "0", count: 0 };
  }
}

/**
 * pi learn — infer system-style.json from structural metadata; queue graph build.
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = learnBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid body.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  const inputData = {
    organization_id: request.organizationId,
    metadata: parsed.data.metadata,
  };

  const governanceRole = await resolvePiCliRole(request.organizationId, request.developerId);
  const governanceMode = getPiCliGovernanceMode();
  const allowTeamCloud =
    governanceMode === "disabled" || canPersistTeamSystemStyle(governanceRole);

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
      { workflow_key: "cliLearnWorkflow", phase: "async" },
    );
  }

  if (workflowEnabled && asyncRequested) {
    try {
      const wf = mastra.getWorkflow("cliLearnWorkflow");
      const run = await wf.createRun({ resourceId: request.organizationId });
      const handle = await tasks.trigger("cli-workflow-runner", {
        workflow_key: "cliLearnWorkflow",
        organization_id: request.organizationId,
        mastra_run_id: run.runId,
        input_data: inputData as Record<string, unknown>,
      });
      const res = apiSuccessEnvelope({
        data: {
          async: true,
          run_id: run.runId,
          workflow_key: "cliLearnWorkflow",
          trigger_job_id: handle.id,
        },
        object: "pi_cli_learn",
        requestId,
        status: "accepted",
        httpStatus: 202,
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    } catch (e) {
      console.warn("[pi-cli/learn] async_trigger_failed", e);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          "Async learn workflow dispatch failed. Retry later or disable strict mode via X-Pi-Fail-Closed: false.",
          503,
          requestId,
          "api_error",
          {
            workflow_key: "cliLearnWorkflow",
            phase: "async",
            reason: e instanceof Error ? e.message : "trigger_failed",
          },
        );
      }
    }
  }

  if (workflowEnabled) {
    try {
      const wf = mastra.getWorkflow("cliLearnWorkflow");
      const run = await wf.createRun({ resourceId: request.organizationId });
      const result = await run.start({
        inputData,
      });

      if (result.status === "success") {
        const out = result.result as {
          system_style: z.infer<typeof systemStyleSchema>;
          graph_job_triggered: boolean;
          rules_persisted: number;
        };
        const res = apiSuccessEnvelope({
          data: {
            system_style: out.system_style,
            graph_job_triggered: out.graph_job_triggered,
            rules_persisted: out.rules_persisted,
            workflow: "cliLearnWorkflow",
          },
          object: "pi_cli_learn",
          requestId,
          status: "completed",
          httpStatus: 200,
        });
        res.headers.set("X-Request-Id", requestId);
        return res;
      }
      console.warn("[pi-cli/learn] workflow_non_success", result.status);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          `Pi CLI learn workflow terminated with status "${result.status}" instead of "success".`,
          503,
          requestId,
          "api_error",
          { workflow_key: "cliLearnWorkflow", phase: "sync", status: result.status },
        );
      }
    } catch (e) {
      console.warn("[pi-cli/learn] workflow_failed_fallback", e);
      if (strict) {
        return apiError(
          "workflow_unavailable",
          "Pi CLI learn workflow execution failed.",
          503,
          requestId,
          "api_error",
          {
            workflow_key: "cliLearnWorkflow",
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
      { workflow_key: "cliLearnWorkflow", phase: "sync" },
    );
  }

  try {
    const model = getPiCliGeminiModel("lite");
    const templatesInfo = await hashCliTemplates();
    
    const governanceBlock = parsed.data.metadata.governance_sources?.length
      ? `\n\n## Governance sources (WHY decisions, constraints)\n${parsed.data.metadata.governance_sources.join("\n\n")}`
      : "";

    const { object: systemStyle } = await generateObject({
      model,
      schema: systemStyleSchema,
      maxOutputTokens: 4000,
      prompt: `You are Pi (Intelligence Infrastructure). Given structural metadata only (no raw source code), infer a concise system-style profile for this repository.

Metadata JSON:
${JSON.stringify(parsed.data.metadata, null, 2)}
${governanceBlock}

Also use polyglot_hints (file extension counts + sample paths) to infer non-TS stacks present in the repo (Python/Go/Rust/etc). Mention them in libraries[] when credible.

If governance_sources are present, extract:
- governance.rationale[]: WHY choices were made (not WHAT stack) - 3-5 key architectural decisions
- governance.adrs[]: Architecture Decision Record titles/summaries if present
- governance.constraints[]: Explicit MUST/MUST NOT rules from constitution or docs

Respond with best-effort labels (framework, ui library, state management, patterns, libraries, governance).`,
    });

    // Validate libraries[] faithfulness: every entry must appear in import_histogram or package_json
    const importKeys = new Set(Object.keys(parsed.data.metadata.import_histogram ?? {}));
    const pkgKeys = new Set(Object.keys((parsed.data.metadata.package_json?.dependencies as Record<string, unknown>) ?? {}));
    const devKeys = new Set(Object.keys((parsed.data.metadata.package_json?.devDependencies as Record<string, unknown>) ?? {}));
    const allKnownLibs = new Set([...importKeys, ...pkgKeys, ...devKeys]);
    
    systemStyle.libraries = systemStyle.libraries.filter((lib) => {
      // Allow lib if it's in package.json or import histogram, or is a well-known inferred stack
      const normalized = lib.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const known of allKnownLibs) {
        if (known.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normalized) || 
            normalized.includes(known.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
          return true;
        }
      }
      // Allow common framework/platform names even if not in deps (e.g., "next.js", "react")
      const commonStacks = ["next", "react", "vue", "angular", "svelte", "tailwind", "typescript", "javascript"];
      return commonStacks.some(stack => normalized.includes(stack) || stack.includes(normalized));
    });

    // Add templates hash to system-style
    (systemStyle as Record<string, unknown>).templates = templatesInfo;

    let graphJobTriggered = false;
    if (allowTeamCloud) {
      try {
        if (process.env.R2_BUCKET_NAME?.trim() || process.env.R2_PI_GRAPHS_BUCKET?.trim()) {
          await uploadLatestPiSystemStyle(request.organizationId, systemStyle as unknown as Record<string, unknown>);
        }
      } catch (e) {
        console.warn("[pi-cli/learn] system_style_r2_upload_skipped", e);
      }

      try {
        await tasks.trigger("cli-graph-builder", {
          organizationId: request.organizationId,
          fileSamplePaths: parsed.data.metadata.file_sample_paths ?? [],
          fileSources: parsed.data.metadata.file_sources,
        });
        graphJobTriggered = true;
      } catch (e) {
        console.warn("[pi-cli/learn] trigger_optional_failed", e);
      }
    } else {
      await logPiCliGovernanceAction({
        organizationId: request.organizationId,
        developerId: request.developerId,
        action: "learn_team_cloud_skipped",
        details: { role: governanceRole, governance_mode: governanceMode },
      });
    }

    const res = apiSuccessEnvelope({
      data: {
        system_style: systemStyle,
        graph_job_triggered: graphJobTriggered,
        rules_persisted: 0,
        workflow: null,
        governance: {
          role: governanceRole,
          team_cloud_persisted: allowTeamCloud,
          message: allowTeamCloud
            ? undefined
            : "Team cloud snapshot skipped — publishing system-style requires admin or tech_lead (PI_CLI_GOVERNANCE_MODE). Local `pi learn` still receives system_style JSON.",
        },
      },
      object: "pi_cli_learn",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Learn failed.";
    return apiError("learn_failed", message, 500, requestId, "api_error");
  }
});
