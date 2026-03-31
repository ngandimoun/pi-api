import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { campaignAdGenerationInputSchema } from "../contracts/campaign-ads-api";
import { campaignAdEditInputSchema } from "../contracts/campaign-ads-edit-api";
import { campaignAdLocalizationInputSchema } from "../contracts/campaign-localize-api";
import { brandExtractionInputSchema } from "../lib/brand-extraction";
import { getServiceSupabaseClient } from "../lib/supabase";
import {
  createRunInputSchema,
  runActionSchema,
  runStepDefinitionSchema,
  type RunStepDefinition,
} from "../contracts/run-api";

const triggerPayloadSchema = z.object({
  runId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: createRunInputSchema,
});

type RunStepState = {
  id: string;
  action: z.infer<typeof runActionSchema>;
  status: "pending" | "queued" | "processing" | "completed" | "failed" | "skipped";
  depends_on: string[];
  job_id?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  started_at?: number | null;
  completed_at?: number | null;
};

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalStatus(status: string) {
  return status === "completed" || status === "failed";
}

function asObjectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function resolveMappedInputValue(
  expression: string,
  completedByStepId: Map<string, RunStepState>
): unknown {
  const match = /^\$steps\.([^.]+)\.result(?:\.(.+))?$/.exec(expression.trim());
  if (!match) {
    throw new Error(`invalid_input_map_expression:${expression}`);
  }
  const stepId = match[1];
  const path = match[2] ?? "";
  const sourceStep = completedByStepId.get(stepId);
  if (!sourceStep || sourceStep.status !== "completed" || !sourceStep.result) {
    throw new Error(`missing_input_map_source:${stepId}`);
  }
  let cursor: unknown = sourceStep.result;
  if (!path) return cursor;
  for (const segment of path.split(".")) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function resolveStepInput(
  step: RunStepDefinition,
  completedByStepId: Map<string, RunStepState>
): Record<string, unknown> {
  const resolved = { ...step.input };
  const mapRecord = step.input_map ?? {};
  for (const [targetKey, expression] of Object.entries(mapRecord)) {
    resolved[targetKey] = resolveMappedInputValue(expression, completedByStepId);
  }
  return resolved;
}

function extractBrandIdFromJob(job: Record<string, unknown>) {
  const resultUrl = typeof job.result_url === "string" ? job.result_url : "";
  const matched = /^brands\/([0-9a-fA-F-]{36})$/.exec(resultUrl);
  return matched?.[1] ?? null;
}

function extractImageUrlFromJob(job: Record<string, unknown>) {
  const payload = asObjectRecord(job.payload);
  const imageUrl = payload.image_url;
  return typeof imageUrl === "string" ? imageUrl : null;
}

async function updateRunState(
  runId: string,
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled",
  steps: RunStepState[]
) {
  const supabase = getServiceSupabaseClient();
  await supabase
    .from("runs")
    .update({
      status,
      steps,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function createChildJob(params: {
  runId: string;
  stepId: string;
  orgId: string;
  action: z.infer<typeof runActionSchema>;
  input: Record<string, unknown>;
}) {
  const supabase = getServiceSupabaseClient();
  switch (params.action) {
    case "brands.extract": {
      const validated = brandExtractionInputSchema.parse(params.input);
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          org_id: params.orgId,
          run_id: params.runId,
          run_step_id: params.stepId,
          type: "brand_extraction",
          status: "queued",
          payload: { phase: "queued", input: validated },
        })
        .select("id")
        .single();
      if (error || !job) throw new Error("child_job_create_failed");
      await tasks.trigger("omnivorous-brand-extractor", {
        jobId: job.id,
        organizationId: params.orgId,
        input: validated,
      });
      return job.id;
    }
    case "campaigns.generate": {
      const validated = campaignAdGenerationInputSchema.parse(params.input);
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          org_id: params.orgId,
          run_id: params.runId,
          run_step_id: params.stepId,
          type: "campaign_ad_generation",
          status: "queued",
          payload: {
            phase: "queued",
            input: {
              prompt: validated.prompt,
              reference_image_count: validated.reference_images?.length ?? 0,
              brand_id: validated.brand_id ?? undefined,
              has_brand_identity_json: Boolean(validated.brand_identity_json),
              output: validated.output ?? undefined,
              client_reference_id: validated.client_reference_id ?? undefined,
              metadata: validated.metadata ?? undefined,
            },
          },
        })
        .select("id")
        .single();
      if (error || !job) throw new Error("child_job_create_failed");
      await tasks.trigger("campaign-ads-creator", {
        jobId: job.id,
        organizationId: params.orgId,
        input: validated,
      });
      return job.id;
    }
    case "campaigns.edit": {
      const validated = campaignAdEditInputSchema.parse(params.input);
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          org_id: params.orgId,
          run_id: params.runId,
          run_step_id: params.stepId,
          type: "campaign_ad_edit",
          status: "queued",
          payload: {
            phase: "queued",
            source_job_id: validated.source_job_id,
            input: {
              prompt: validated.prompt,
              reference_image_count: validated.reference_images?.length ?? 0,
              brand_id: validated.brand_id ?? undefined,
              output: validated.output ?? undefined,
              client_reference_id: validated.client_reference_id ?? undefined,
              metadata: validated.metadata ?? undefined,
            },
          },
        })
        .select("id")
        .single();
      if (error || !job) throw new Error("child_job_create_failed");
      await tasks.trigger("campaign-ads-editor", {
        jobId: job.id,
        organizationId: params.orgId,
        input: validated,
      });
      return job.id;
    }
    case "campaigns.localize_ad": {
      const validated = campaignAdLocalizationInputSchema.parse(params.input);
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          org_id: params.orgId,
          run_id: params.runId,
          run_step_id: params.stepId,
          type: "campaign_ad_localization",
          status: "queued",
          payload: {
            phase: "queued",
            input: {
              prompt: validated.prompt,
              source_job_id: validated.source_job_id ?? undefined,
              target_culture: validated.target_culture,
              target_language: validated.target_language ?? undefined,
              target_currency: validated.target_currency ?? undefined,
              brand_id: validated.brand_id ?? undefined,
              reference_image_count: validated.reference_images?.length ?? 0,
              output: validated.output ?? undefined,
              client_reference_id: validated.client_reference_id ?? undefined,
              metadata: validated.metadata ?? undefined,
              source_image_provided: Boolean(validated.source_image_url),
            },
          },
        })
        .select("id")
        .single();
      if (error || !job) throw new Error("child_job_create_failed");
      await tasks.trigger("campaign-ads-localizer", {
        jobId: job.id,
        organizationId: params.orgId,
        input: validated,
      });
      return job.id;
    }
    default:
      throw new Error("unsupported_action");
  }
}

async function waitForChildJob(jobId: string, orgId: string) {
  const supabase = getServiceSupabaseClient();
  while (true) {
    const { data, error } = await supabase
      .from("jobs")
      .select("id,org_id,status,type,payload,result_url,error_log")
      .eq("id", jobId)
      .maybeSingle();
    if (error || !data || data.org_id !== orgId) {
      throw new Error("child_job_lookup_failed");
    }
    if (isTerminalStatus(String(data.status))) {
      return data as Record<string, unknown>;
    }
    await sleep(1000);
  }
}

function buildStepResult(action: z.infer<typeof runActionSchema>, childJob: Record<string, unknown>) {
  switch (action) {
    case "brands.extract":
      return {
        job_id: String(childJob.id),
        brand_id: extractBrandIdFromJob(childJob),
        result_url: childJob.result_url ?? null,
      };
    case "campaigns.generate":
    case "campaigns.edit":
    case "campaigns.localize_ad":
      return {
        job_id: String(childJob.id),
        image_url: extractImageUrlFromJob(childJob),
        result_url: childJob.result_url ?? null,
      };
    default:
      return { job_id: String(childJob.id) };
  }
}

function getReadyStepIds(stepStates: RunStepState[]) {
  const completedStepIds = new Set(
    stepStates.filter((s) => s.status === "completed").map((s) => s.id)
  );
  return stepStates
    .filter((step) => step.status === "pending")
    .filter((step) => step.depends_on.every((id) => completedStepIds.has(id)))
    .map((step) => step.id);
}

function topologicalValidate(steps: RunStepDefinition[]) {
  const ids = new Set<string>();
  const depMap = new Map<string, string[]>();
  for (const step of steps) {
    if (ids.has(step.id)) throw new Error(`duplicate_step_id:${step.id}`);
    ids.add(step.id);
    depMap.set(step.id, step.depends_on);
  }
  for (const step of steps) {
    for (const dep of step.depends_on) {
      if (!ids.has(dep)) throw new Error(`unknown_dependency:${dep}`);
      if (dep === step.id) throw new Error(`self_dependency:${dep}`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      throw new Error(`dependency_cycle:${id}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of depMap.get(id) ?? []) {
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) {
    visit(id);
  }
}

export const pipelineRunOrchestrator = task({
  id: "pipeline-run-orchestrator",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { runId, organizationId, input } = parsed;
    topologicalValidate(input.steps);

    const stepById = new Map(input.steps.map((step) => [step.id, runStepDefinitionSchema.parse(step)]));
    const stepStates: RunStepState[] = input.steps.map((step) => ({
      id: step.id,
      action: step.action,
      status: "pending",
      depends_on: step.depends_on,
      job_id: null,
      result: null,
      error: null,
      started_at: null,
      completed_at: null,
    }));
    const stateById = new Map(stepStates.map((s) => [s.id, s]));
    const completedByStepId = new Map<string, RunStepState>();

    await updateRunState(runId, "in_progress", stepStates);

    try {
      while (true) {
        const readyStepIds = getReadyStepIds(stepStates);
        if (readyStepIds.length === 0) {
          break;
        }

        await Promise.all(
          readyStepIds.map(async (stepId) => {
            const definition = stepById.get(stepId);
            const state = stateById.get(stepId);
            if (!definition || !state) return;

            state.status = "queued";
            state.started_at = nowUnix();
            await updateRunState(runId, "in_progress", stepStates);

            try {
              const resolvedInput = resolveStepInput(definition, completedByStepId);
              state.status = "processing";
              await updateRunState(runId, "in_progress", stepStates);

              const childJobId = await createChildJob({
                runId,
                stepId,
                orgId: organizationId,
                action: definition.action,
                input: resolvedInput,
              });
              state.job_id = childJobId;
              await updateRunState(runId, "in_progress", stepStates);

              const childJob = await waitForChildJob(childJobId, organizationId);
              const childStatus = String(childJob.status);
              if (childStatus === "completed") {
                state.status = "completed";
                state.result = buildStepResult(definition.action, childJob);
                state.error = null;
                state.completed_at = nowUnix();
                completedByStepId.set(stepId, state);
              } else {
                state.status = "failed";
                state.result = {
                  job_id: childJobId,
                  error_log: childJob.error_log ?? null,
                };
                state.error = String(childJob.error_log ?? "child_job_failed");
                state.completed_at = nowUnix();
              }
            } catch (error) {
              state.status = "failed";
              state.error = error instanceof Error ? error.message : "step_failed";
              state.completed_at = nowUnix();
            } finally {
              await updateRunState(runId, "in_progress", stepStates);
            }
          })
        );

        if (stepStates.some((step) => step.status === "failed")) {
          break;
        }
      }

      const hasFailed = stepStates.some((step) => step.status === "failed");
      if (hasFailed) {
        const completedOrFailed = new Set(
          stepStates
            .filter((step) => step.status === "completed" || step.status === "failed")
            .map((step) => step.id)
        );
        for (const step of stepStates) {
          if (step.status === "pending" && step.depends_on.some((dep) => !completedOrFailed.has(dep))) {
            step.status = "skipped";
            step.completed_at = nowUnix();
            step.error = "dependency_failed";
          }
        }
        await updateRunState(runId, "failed", stepStates);
        return { status: "failed" as const, run_id: runId };
      }

      if (stepStates.every((step) => step.status === "completed")) {
        await updateRunState(runId, "completed", stepStates);
        return { status: "completed" as const, run_id: runId };
      }

      // If no step can progress and none failed/completed all, mark as failed to avoid stuck runs.
      await updateRunState(runId, "failed", stepStates);
      return { status: "failed" as const, run_id: runId, error: "run_stalled" };
    } catch (error) {
      await updateRunState(runId, "failed", stepStates);
      throw error;
    }
  },
});
