import crypto from "crypto";

import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

import { robotRunInputSchema, type RobotRunInput } from "../../contracts/robotics-api";
import { apiError, apiZodError } from "../api-response";
import { getServiceSupabaseClient } from "../supabase";
import type { AuthenticatedRequest } from "../../types/api";
import { mergeRobotRunConfig } from "./robot-profiles";
import { upsertRobot } from "./robot-manager";
import { ros2RegisterRobot } from "./ros2-bridge-client";

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export type RobotRunAnalyzerPayload = {
  jobId: string;
  organizationId: string;
  input: RobotRunInput;
};

export async function queueRobotRun(request: AuthenticatedRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = robotRunInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const merged = mergeRobotRunConfig(parsed.data, parsed.data.profile);

  const supabase = getServiceSupabaseClient();

  // Best-effort: ensure robot exists so /robots/:id/status can work immediately.
  try {
    await upsertRobot({
      supabase,
      orgId: request.organizationId,
      input: {
        robot_id: merged.robot_id,
        name: merged.robot_id,
        capabilities: [],
        connection: {},
        profile: merged.profile,
      },
    });
  } catch {
    // non-fatal
  }

  // Best-effort: register with ROS2 sidecar (stub mode is fine).
  try {
    await ros2RegisterRobot({ robotId: merged.robot_id, requestId: request.requestId });
  } catch {
    // non-fatal
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  const scope = "robot_runs";
  const requestHash = sha256Hex(stableStringify(merged));
  const keyHash = idempotencyKey ? sha256Hex(idempotencyKey) : null;

  if (keyHash) {
    const { data: existing, error: existingError } = await supabase
      .from("idempotency_requests")
      .select("request_hash,response_status,response_body")
      .eq("org_id", request.organizationId)
      .eq("scope", scope)
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (!existingError && existing) {
      if (existing.request_hash !== requestHash) {
        return apiError(
          "idempotency_key_mismatch",
          "Idempotency-Key was already used with a different request payload.",
          409,
          request.requestId,
          "invalid_request_error",
          { param: "Idempotency-Key" }
        );
      }

      const replay = NextResponse.json(existing.response_body, {
        status: Number(existing.response_status) || 200,
      });
      replay.headers.set("X-Idempotency-Replayed", "true");
      return replay;
    }
  }

  const { data: job, error: jobInsertError } = await supabase
    .from("jobs")
    .insert({
      org_id: request.organizationId,
      type: "robot_run",
      status: "queued",
      payload: {
        phase: "queued",
        input: {
          robot_id: merged.robot_id,
          task: merged.task,
          behaviors_count: merged.behaviors?.length ?? 0,
          actions_count: merged.actions?.length ?? 0,
        },
      },
    })
    .select("id")
    .single();

  if (jobInsertError || !job) {
    return apiError("job_create_failed", "Failed to create robot run job.", 500, request.requestId, "api_error");
  }

  const triggerPayload: RobotRunAnalyzerPayload = {
    jobId: job.id,
    organizationId: request.organizationId,
    input: merged,
  };

  try {
    await tasks.trigger("robot-run-analyzer", triggerPayload);
  } catch (error) {
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_log: error instanceof Error ? error.stack ?? error.message : "trigger_failed",
        payload: { phase: "failed" },
      })
      .eq("id", job.id);

    return apiError(
      "job_trigger_failed",
      "Failed to trigger background worker.",
      502,
      request.requestId,
      "api_error"
    );
  }

  const responseBody = {
    id: request.requestId,
    object: "job",
    status: "queued",
    created_at: Math.floor(Date.now() / 1000),
    data: { job_id: job.id },
  };

  if (keyHash) {
    await supabase.from("idempotency_requests").insert({
      org_id: request.organizationId,
      scope,
      key_hash: keyHash,
      request_hash: requestHash,
      response_status: 202,
      response_body: responseBody,
    });
  }

  return NextResponse.json(responseBody, { status: 202 });
}

