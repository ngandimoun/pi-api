import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import {
  brandExtractionInputSchema,
  type BrandExtractionInput,
} from "@/lib/brand-extraction";
import { getServiceSupabaseClient } from "@/lib/supabase";

type BrandExtractorTriggerPayload = {
  jobId: string;
  organizationId: string;
  input: BrandExtractionInput;
  providerKeys?: {
    gemini?: string;
    firecrawl?: string;
  };
};

/**
 * Creates a queued brand extraction job and triggers the async worker.
 */
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

  const parsed = brandExtractionInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_request_body",
      parsed.error.issues[0]?.message ?? "Invalid request payload.",
      400,
      request.requestId
    );
  }

  const supabase = getServiceSupabaseClient();

  const { data: job, error: jobInsertError } = await supabase
    .from("jobs")
    .insert({
      org_id: request.organizationId,
      type: "brand_extraction",
      status: "queued",
      payload: {
        phase: "queued",
        input: parsed.data,
      },
    })
    .select("id,created_at")
    .single();

  if (jobInsertError || !job) {
    return apiError(
      "job_create_failed",
      "Failed to create extraction job.",
      500,
      request.requestId,
      "api_error"
    );
  }

  const triggerPayload: BrandExtractorTriggerPayload = {
    jobId: job.id,
    organizationId: request.organizationId,
    input: parsed.data,
    providerKeys: request.providerKeys
      ? { gemini: request.providerKeys.gemini, firecrawl: request.providerKeys.firecrawl }
      : undefined,
  };

  try {
    await tasks.trigger("omnivorous-brand-extractor", triggerPayload);
  } catch (error) {
    console.error("[brand-extract] trigger_failed", {
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
          input: parsed.data,
        },
      })
      .eq("id", job.id);

    return apiError(
      "job_trigger_failed",
      "Failed to trigger extraction worker.",
      502,
      request.requestId,
      "api_error"
    );
  }

  console.info("[brand-extract] queued", {
    requestId: request.requestId,
    jobId: job.id,
    orgId: request.organizationId,
    hasUrl: Boolean(parsed.data.url),
    imageCount: parsed.data.imagesBase64?.length ?? 0,
    hasLogo: Boolean(parsed.data.logoBase64),
  });

  return NextResponse.json(
    {
      id: request.requestId,
      object: "job",
      status: "queued",
      created_at: Math.floor(Date.now() / 1000),
      data: {
        job_id: job.id,
      },
    },
    { status: 202 }
  );
});
