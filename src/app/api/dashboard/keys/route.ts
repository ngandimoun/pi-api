import { NextRequest } from "next/server";
import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { ensureUserProfileRow } from "@/lib/ensure-user-profile";
import { isPaidSubscriptionStatus } from "@/lib/subscription";
import { createSupabaseForBearer } from "@/lib/supabase-route-user";
import { createPiApiKey } from "@/lib/unkey";

/**
 * Get user's API keys
 */
export async function GET(request: NextRequest) {
  const requestId = `req_keys_${crypto.randomUUID()}`;

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
      console.error("ensureUserProfileRow:", ensured.message);
      return apiError("profile_error", "Could not load your profile.", 500, requestId, "api_error");
    }

    const { data: apiKeys, error: keysError } = await supabase
      .from("api_keys")
      .select("id, name, last_used_at, created_at, revoked_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (keysError) {
      return apiError("fetch_error", "Failed to fetch API keys", 500, requestId, "api_error");
    }

    return apiSuccessEnvelope({
      data: { keys: apiKeys || [] },
      object: "api_keys",
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
 * Create new API key for authenticated user
 */
export async function POST(request: NextRequest) {
  const requestId = `req_create_key_${crypto.randomUUID()}`;

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
      console.error("ensureUserProfileRow:", ensured.message);
      return apiError(
        "profile_error",
        "Could not prepare your account profile. Try signing out and back in.",
        500,
        requestId,
        "api_error"
      );
    }

    const body = await request.json().catch(() => ({}));
    const keyName = body.name || `Pi CLI Key - ${new Date().toISOString().split("T")[0]}`;

    const { data: userRow, error: userRowError } = await supabase
      .from("users")
      .select("subscription_status, subscription_tier")
      .eq("id", user.id)
      .single();

    if (userRowError) {
      console.error("Error loading user subscription:", userRowError);
      return apiError("profile_error", "Failed to load subscription state.", 500, requestId, "api_error");
    }

    const subscriptionActive = isPaidSubscriptionStatus(userRow?.subscription_status);
    const tier = (userRow?.subscription_tier ?? "starter").toLowerCase();

    const unkeyResult = await createPiApiKey({
      organizationId: user.id,
      name: keyName,
      enabled: subscriptionActive,
      subscriptionTier: tier,
    });

    const { data: apiKeyRecord, error: dbError } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        unkey_key_id: unkeyResult.keyId!,
        name: keyName,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error storing API key metadata:", dbError);
      return apiError("store_error", "Failed to store API key metadata", 500, requestId, "api_error");
    }

    return apiSuccessEnvelope({
      data: {
        key: unkeyResult.key,
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        created_at: apiKeyRecord.created_at,
        key_status: subscriptionActive ? "active" : "disabled_pending_payment",
      },
      object: "api_key_created",
      requestId,
      status: "completed",
      httpStatus: 201,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating API key:", error);
    let message = raw;
    if (/Missing UNKEY|UNKEY_ROOT_KEY|UNKEY_API_ID/i.test(raw)) {
      message =
        "API key service isn’t configured on this server. Add UNKEY_ROOT_KEY and UNKEY_API_ID to the deployment environment.";
    }
    return apiError("internal_error", message, 500, requestId, "api_error");
  }
}
