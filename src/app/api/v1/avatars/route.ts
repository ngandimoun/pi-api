import { apiError, apiSuccess } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

/**
 * Lists saved avatars for the authenticated organization.
 */
export const GET = withApiAuth(async (request) => {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

  const supabase = getServiceSupabaseClient();
  const { data: rows, error, count } = await supabase
    .from("org_saved_avatars")
    .select("id,label,image_url,created_at", { count: "exact" })
    .eq("org_id", request.organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError(
      "list_failed",
      "Failed to list saved avatars.",
      500,
      request.requestId,
      "api_error"
    );
  }

  const total = count ?? 0;
  return apiSuccess(
    {
      object: "list",
      data: rows ?? [],
      has_more: offset + (rows?.length ?? 0) < total,
      total_count: total,
    },
    "list",
    request.requestId
  );
});
