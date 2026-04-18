import { NextRequest } from "next/server";
import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { ensureUserProfileRow } from "@/lib/ensure-user-profile";
import { workflowQuotaMatrixForTier } from "@/lib/pi-cli-plan-limits";
import { createSupabaseForBearer } from "@/lib/supabase-route-user";

/**
 * Get current user profile
 */
export async function GET(request: NextRequest) {
  const requestId = `req_profile_${crypto.randomUUID()}`;

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return apiError(
        "missing_auth",
        "Missing Authorization header",
        401,
        requestId,
        "invalid_request_error"
      );
    }

    const token = authHeader.slice(7);
    const supabase = createSupabaseForBearer(token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return apiError(
        "invalid_token",
        "Invalid authorization token",
        401,
        requestId,
        "authentication_error"
      );
    }

    const ensured = await ensureUserProfileRow(supabase, user);
    if (!ensured.ok) {
      return apiError("profile_error", "Failed to prepare user profile.", 500, requestId, "api_error");
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return apiError("profile_error", "Failed to fetch user profile", 500, requestId, "api_error");
    }

    const { count: totalRequests } = await supabase
      .from("usage_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyRequests } = await supabase
      .from("usage_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString());

    const { count: apiKeysCount } = await supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const workflow_quotas = workflowQuotaMatrixForTier(profile?.subscription_tier as string | null);

    return apiSuccessEnvelope({
      data: {
        ...profile,
        usage: {
          total_requests: totalRequests || 0,
          monthly_requests: monthlyRequests || 0,
          api_keys_count: apiKeysCount || 0,
          workflow_quotas,
        },
      },
      object: "user_profile",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("internal_error", message, 500, requestId, "api_error");
  }
}

/**
 * Update user profile
 */
export async function PUT(request: NextRequest) {
  const requestId = `req_update_profile_${crypto.randomUUID()}`;

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return apiError(
        "missing_auth",
        "Missing Authorization header",
        401,
        requestId,
        "invalid_request_error"
      );
    }

    const token = authHeader.slice(7);
    const supabase = createSupabaseForBearer(token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return apiError(
        "invalid_token",
        "Invalid authorization token",
        401,
        requestId,
        "authentication_error"
      );
    }

    const ensured = await ensureUserProfileRow(supabase, user);
    if (!ensured.ok) {
      return apiError("profile_error", "Failed to prepare user profile.", 500, requestId, "api_error");
    }

    const body = await request.json().catch(() => ({}));

    const { data: updatedProfile, error: updateError } = await supabase
      .from("users")
      .update({
        full_name: body.full_name,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      return apiError("update_error", "Failed to update user profile", 500, requestId, "api_error");
    }

    return apiSuccessEnvelope({
      data: updatedProfile,
      object: "user_profile_updated",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("internal_error", message, 500, requestId, "api_error");
  }
}
