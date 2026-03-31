import crypto from "crypto";

import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

import { adGenerationInputSchema, type AdGenerationInput } from "../../contracts/ads-api";
import { apiError, apiZodError } from "../api-response";
import { getServiceSupabaseClient } from "../supabase";
import type { AuthenticatedRequest } from "../../types/api";

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

type AdsCreatorPayload = {
  jobId: string;
  organizationId: string;
  input: AdGenerationInput;
};

export async function queueAdGeneration(request: AuthenticatedRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = adGenerationInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  const scope = "ads_generate";
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
      type: "ad_generation",
      status: "queued",
      payload: {
        phase: "queued",
        input: {
          prompt: parsed.data.prompt,
          reference_image_count: parsed.data.reference_images?.length ?? 0,
          has_brand_id: Boolean(parsed.data.brand_id),
          has_brand_identity_json: Boolean(parsed.data.brand_identity_json),
          output: parsed.data.output ?? undefined,
          client_reference_id: parsed.data.client_reference_id ?? undefined,
          metadata: parsed.data.metadata ?? undefined,
        },
      },
    })
    .select("id")
    .single();

  if (jobInsertError || !job) {
    return apiError("job_create_failed", "Failed to create generation job.", 500, request.requestId, "api_error");
  }

  const triggerPayload: AdsCreatorPayload = {
    jobId: job.id,
    organizationId: request.organizationId,
    input: parsed.data,
  };

  try {
    await tasks.trigger("ads-creator", triggerPayload);
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

