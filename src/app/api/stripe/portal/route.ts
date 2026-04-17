import { NextRequest } from "next/server";
import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { ensureUserProfileRow } from "@/lib/ensure-user-profile";
import { getStripeServer } from "@/lib/stripe-server";
import { createSupabaseForBearer } from "@/lib/supabase-route-user";

export async function POST(req: NextRequest) {
  const requestId = `req_portal_${crypto.randomUUID()}`;

  try {
    const stripe = getStripeServer();
    const authHeader = req.headers.get("Authorization");
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
      return apiError("profile_error", "Could not load your account profile.", 500, requestId, "api_error");
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile?.stripe_customer_id) {
      return apiError(
        "no_customer",
        "No billing account yet. Subscribe to a plan first, then you can manage payment details here.",
        400,
        requestId,
        "invalid_request_error"
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: userProfile.stripe_customer_id,
      return_url: `${req.nextUrl.origin}/dashboard`,
    });

    return apiSuccessEnvelope({
      data: {
        portal_url: session.url,
      },
      object: "customer_portal",
      requestId,
      status: "created",
      httpStatus: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe portal error:", error);
    return apiError("stripe_error", message, 500, requestId, "api_error");
  }
}
