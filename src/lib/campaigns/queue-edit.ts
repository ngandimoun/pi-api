import crypto from "crypto";

import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";
import { z } from "zod";

import { campaignAdEditInputSchema, type CampaignAdEditInput } from "@/contracts/campaign-ads-edit-api";
import { apiError, apiZodError } from "@/lib/api-response";
import { getServiceSupabaseClient } from "@/lib/supabase";
import type { AuthenticatedRequest } from "@/types/api";

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

type CampaignAdsEditorPayload = {
  jobId: string;
  organizationId: string;
  input: CampaignAdEditInput;
};

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: campaignAdEditInputSchema,
});

async function getSourceJobOrError(params: {
  supabase: ReturnType<typeof getServiceSupabaseClient>;
  organizationId: string;
  sourceJobId: string;
}): Promise<{ type: string; status: string; imageUrl: string }> {
  const { data: sourceJob, error } = await params.supabase
    .from("jobs")
    .select("type,status,payload,org_id")
    .eq("id", params.sourceJobId)
    .maybeSingle();

  if (error || !sourceJob) {
    return Promise.reject(new Error("source_job_not_found"));
  }
  if (sourceJob.org_id !== params.organizationId) {
    return Promise.reject(new Error("source_job_not_found"));
  }
  const type = String(sourceJob.type);
  const status = String(sourceJob.status);
  if (type !== "campaign_ad_generation" && type !== "campaign_ad_edit") {
    return Promise.reject(new Error("source_job_type_invalid"));
  }
  if (status !== "completed") {
    return Promise.reject(new Error("source_job_not_completed"));
  }

  const payload = sourceJob.payload as Record<string, unknown> | null | undefined;
  const imageUrl = payload?.image_url;
  if (typeof imageUrl !== "string") {
    return Promise.reject(new Error("source_job_missing_image"));
  }

  return { type, status, imageUrl };
}

export async function queueCampaignEdit(request: AuthenticatedRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = campaignAdEditInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  const scope = "campaigns_edit";
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

  try {
    await getSourceJobOrError({
      supabase,
      organizationId: request.organizationId,
      sourceJobId: parsed.data.source_job_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "source_job_validation_failed";
    const codeMap: Record<string, { statusCode: number; code: string; message: string }> = {
      source_job_not_found: { statusCode: 404, code: "source_job_not_found", message: "Source job not found." },
      source_job_type_invalid: {
        statusCode: 400,
        code: "source_job_type_invalid",
        message: "source_job_id must reference a campaign_ad_generation or campaign_ad_edit job.",
      },
      source_job_not_completed: {
        statusCode: 400,
        code: "source_job_not_completed",
        message: "source_job_id must reference a completed generation job.",
      },
      source_job_missing_image: {
        statusCode: 400,
        code: "source_job_missing_image",
        message: "Source job has no image available for editing.",
      },
    };

    const mapped = codeMap[message] ?? {
      statusCode: 400,
      code: "source_job_validation_failed",
      message: "Failed to validate source job for editing.",
    };
    return apiError(mapped.code, mapped.message, mapped.statusCode, request.requestId, "invalid_request_error");
  }

  const { data: job, error: jobInsertError } = await supabase
    .from("jobs")
    .insert({
      org_id: request.organizationId,
      type: "campaign_ad_edit",
      status: "queued",
      payload: {
        phase: "queued",
        source_job_id: parsed.data.source_job_id,
        input: {
          prompt: parsed.data.prompt,
          reference_image_count: parsed.data.reference_images?.length ?? 0,
          brand_id: parsed.data.brand_id ?? undefined,
          output: parsed.data.output ?? undefined,
          client_reference_id: parsed.data.client_reference_id ?? undefined,
          metadata: parsed.data.metadata ?? undefined,
        },
      },
    })
    .select("id")
    .single();

  if (jobInsertError || !job) {
    return apiError("job_create_failed", "Failed to create edit job.", 500, request.requestId, "api_error");
  }

  const triggerPayload: CampaignAdsEditorPayload = {
    jobId: job.id,
    organizationId: request.organizationId,
    input: parsed.data,
  };

  // Runtime-guard in case we ever change schemas.
  triggerPayloadSchema.parse(triggerPayload);

  try {
    await tasks.trigger("campaign-ads-editor", triggerPayload);
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

