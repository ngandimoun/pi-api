import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

import { createRunInputSchema } from "@/contracts/run-api";
import { apiError, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

function toInitialStepState(steps: Array<{ id: string; action: string; depends_on?: string[] }>) {
  return steps.map((step) => ({
    id: step.id,
    action: step.action,
    status: "pending",
    depends_on: step.depends_on ?? [],
    job_id: null,
    result: null,
    error: null,
    started_at: null,
    completed_at: null,
  }));
}

function validateRunDag(steps: Array<{ id: string; depends_on?: string[] }>) {
  const ids = new Set<string>();
  const depMap = new Map<string, string[]>();
  for (const step of steps) {
    if (ids.has(step.id)) {
      throw new Error(`duplicate_step_id:${step.id}`);
    }
    ids.add(step.id);
    depMap.set(step.id, step.depends_on ?? []);
  }
  for (const step of steps) {
    for (const dep of step.depends_on ?? []) {
      if (!ids.has(dep)) {
        throw new Error(`unknown_dependency:${dep}`);
      }
      if (dep === step.id) {
        throw new Error(`self_dependency:${dep}`);
      }
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

/**
 * Create a multi-step pipeline run and execute asynchronously via Trigger.dev.
 */
export const POST = withApiAuth(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = createRunInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }
  try {
    validateRunDag(parsed.data.steps);
  } catch (error) {
    return apiError(
      "invalid_run_dag",
      error instanceof Error ? error.message : "Run DAG validation failed.",
      400,
      request.requestId
    );
  }

  const supabase = getServiceSupabaseClient();
  const initialSteps = toInitialStepState(parsed.data.steps);
  const { data: run, error: runInsertError } = await supabase
    .from("runs")
    .insert({
      org_id: request.organizationId,
      status: "pending",
      steps: initialSteps,
      metadata: parsed.data.metadata ?? null,
    })
    .select("id,status")
    .single();

  if (runInsertError || !run) {
    return apiError("run_create_failed", "Failed to create pipeline run.", 500, request.requestId, "api_error");
  }

  try {
    await tasks.trigger("pipeline-run-orchestrator", {
      runId: run.id,
      organizationId: request.organizationId,
      input: parsed.data,
    });
  } catch (error) {
    await supabase
      .from("runs")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return apiError(
      "run_trigger_failed",
      "Failed to trigger pipeline run orchestrator.",
      502,
      request.requestId,
      "api_error"
    );
  }

  return NextResponse.json(
    {
      id: request.requestId,
      object: "run",
      status: "queued",
      created_at: Math.floor(Date.now() / 1000),
      data: {
        run_id: run.id,
        status: run.status,
        steps: initialSteps.map((step) => ({ id: step.id, status: step.status })),
      },
    },
    { status: 202 }
  );
});
