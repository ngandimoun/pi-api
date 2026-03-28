import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";
import crypto from "crypto";

import { apiError, apiZodError } from "@/lib/api-response";
import {
  avatarGenerationInputSchema,
  type AvatarGenerationInput,
} from "@/contracts/avatar-api";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`)
    .join(",")}}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

type AvatarCreatorPayload = {
  jobId: string;
  organizationId: string;
  input: AvatarGenerationInput;
};

export const POST = withApiAuth(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(
      "invalid_json_body",
      "Request body must be valid JSON.",
      400,
      request.requestId
    );
  }

  const parsed = avatarGenerationInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  const scope = "avatars_generate";
  const requestHash = sha256Hex(stableStringify(parsed.data));
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

      const response = NextResponse.json(existing.response_body, {
        status: Number(existing.response_status) || 200,
      });
      response.headers.set("X-Idempotency-Replayed", "true");
      return response;
    }
  }

  const { data: job, error: jobInsertError } = await supabase
    .from("jobs")
    .insert({
      org_id: request.organizationId,
      type: "avatar_generation",
      status: "queued",
      payload: {
        phase: "queued",
        input: {
          prompt: parsed.data.prompt,
          hints: parsed.data.hints,
          reference_image_count: parsed.data.reference_images?.length ?? 0,
          client_reference_id: parsed.data.client_reference_id ?? undefined,
          metadata: parsed.data.metadata ?? undefined,
        },
      },
    })
    .select("id,created_at")
    .single();

  if (jobInsertError || !job) {
    return apiError(
      "job_create_failed",
      "Failed to create generation job.",
      500,
      request.requestId,
      "api_error"
    );
  }

  const triggerPayload: AvatarCreatorPayload = {
    jobId: job.id,
    organizationId: request.organizationId,
    input: parsed.data,
  };

  try {
    await tasks.trigger("avatar-creator", triggerPayload);
  } catch (error) {
    console.error("[avatars.generate] trigger_failed", {
      requestId: request.requestId,
      jobId: job.id,
      error,
    });

    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_log:
          error instanceof Error ? error.stack ?? error.message : "trigger_failed",
        payload: {
          phase: "failed",
          input: triggerPayload.input,
        },
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

  console.info("[avatars.generate] queued", {
    requestId: request.requestId,
    jobId: job.id,
    orgId: request.organizationId,
    referenceCount: parsed.data.reference_images?.length ?? 0,
  });

  const responseBody = {
    id: request.requestId,
    object: "job",
    status: "queued",
    created_at: Math.floor(Date.now() / 1000),
    data: {
      job_id: job.id,
    },
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
});
