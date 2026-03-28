import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { avatarSaveInputSchema } from "@/contracts/avatar-api";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

function payloadAsRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

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

  const parsed = avatarSaveInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id,org_id,status,type,payload")
    .eq("id", parsed.data.job_id)
    .maybeSingle();

  if (jobError || !job) {
    return apiError("job_not_found", "Job not found.", 404, request.requestId);
  }

  if (job.org_id !== request.organizationId) {
    return apiError("job_not_found", "Job not found.", 404, request.requestId);
  }

  if (job.type !== "avatar_generation") {
    return apiError(
      "invalid_job_type",
      "This job cannot be saved as an avatar.",
      400,
      request.requestId
    );
  }

  if (job.status !== "completed") {
    return apiError(
      "job_not_complete",
      "Wait until generation completes before saving.",
      409,
      request.requestId
    );
  }

  const payload = payloadAsRecord(job.payload);
  const imageUrl = payload?.image_url;
  if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
    return apiError(
      "avatar_image_missing",
      "Completed job has no image to save.",
      500,
      request.requestId,
      "api_error"
    );
  }

  const { data: row, error: insertError } = await supabase
    .from("org_saved_avatars")
    .insert({
      org_id: request.organizationId,
      label: parsed.data.label ?? null,
      image_url: imageUrl,
      metadata: { source_job_id: job.id },
    })
    .select("id,label,image_url,created_at")
    .single();

  if (insertError || !row) {
    return apiError(
      "save_failed",
      "Could not save avatar.",
      500,
      request.requestId,
      "api_error"
    );
  }

  return apiSuccess(
    {
      id: row.id,
      object: "saved_avatar",
      label: row.label,
      image_url: row.image_url,
      created_at: row.created_at,
    },
    "saved_avatar",
    request.requestId
  );
});
