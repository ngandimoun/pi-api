import { z } from "zod";

import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

async function resolveRouteParams(
  params: unknown
): Promise<Record<string, string | string[]> | undefined> {
  if (!params) {
    return undefined;
  }
  if (typeof (params as Promise<unknown>).then === "function") {
    const awaited = await (params as Promise<unknown>);
    if (awaited && typeof awaited === "object") {
      return awaited as Record<string, string | string[]>;
    }
    return undefined;
  }
  if (typeof params === "object") {
    return params as Record<string, string | string[]>;
  }
  return undefined;
}

export const GET = withApiAuth(async (request, context) => {
  const resolvedParams = await resolveRouteParams(context.params);
  const parsed = paramsSchema.safeParse(resolvedParams ?? {});
  if (!parsed.success) {
    return apiZodError("invalid_id", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const { data: row, error } = await supabase
    .from("org_saved_avatars")
    .select("id,org_id,label,image_url,created_at,updated_at")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (error || !row) {
    return apiError("not_found", "Avatar not found.", 404, request.requestId);
  }

  if (row.org_id !== request.organizationId) {
    return apiError("not_found", "Avatar not found.", 404, request.requestId);
  }

  return apiSuccess(
    {
      id: row.id,
      object: "saved_avatar",
      label: row.label,
      image_url: row.image_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    "saved_avatar",
    request.requestId
  );
});
