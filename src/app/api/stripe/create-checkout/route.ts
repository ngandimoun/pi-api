import { NextRequest } from "next/server";
import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { ensureUserProfileRow } from "@/lib/ensure-user-profile";
import { isUsableStripePriceId, resolvePriceIdForTier } from "@/lib/stripe-price-id";
import { getStripeServer } from "@/lib/stripe-server";
import { createSupabaseForBearer } from "@/lib/supabase-route-user";

export async function POST(req: NextRequest) {
  const requestId = `req_checkout_${crypto.randomUUID()}`;

  try {
    const stripe = getStripeServer();
    // Get the user from the authorization header
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

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { tier } = body as { tier?: string };

    const allowed = new Set(["starter", "pro", "enterprise"]);
    if (!tier || typeof tier !== "string" || !allowed.has(tier)) {
      return apiError(
        "invalid_tier",
        "Invalid subscription tier.",
        400,
        requestId,
        "invalid_request_error"
      );
    }

    const serverPriceId = resolvePriceIdForTier(tier);
    if (!serverPriceId || !isUsableStripePriceId(serverPriceId)) {
      return apiError(
        "billing_not_configured",
        "Subscription billing is not configured. Add valid per-plan product price IDs to the server environment.",
        503,
        requestId,
        "api_error"
      );
    }

    // Get or create Stripe customer
    let customerId: string;
    
    const { data: userProfile } = await supabase
      .from("users")
      .select("stripe_customer_id, email, full_name")
      .eq("id", user.id)
      .single();

    if (userProfile?.stripe_customer_id) {
      customerId = userProfile.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userProfile?.email || user.email!,
        name: userProfile?.full_name || undefined,
        metadata: {
          user_id: user.id,
        },
      });
      
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: serverPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.nextUrl.origin}/dashboard/billing?checkout=success`,
      cancel_url: `${req.nextUrl.origin}/dashboard/billing?checkout=canceled`,
      metadata: {
        user_id: user.id,
        tier: tier,
      },
    });

    return apiSuccessEnvelope({
      data: {
        checkout_url: session.url,
        session_id: session.id,
      },
      object: "checkout_session",
      requestId,
      status: "created",
      httpStatus: 200,
    });
  } catch (error: unknown) {
    console.error("Stripe checkout error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    if (/no such price/i.test(msg)) {
      return apiError(
        "invalid_price",
        "The subscription price IDs on the server are invalid or outdated. Update them to match your billing dashboard.",
        503,
        requestId,
        "api_error"
      );
    }
    return apiError("checkout_error", msg, 500, requestId, "api_error");
  }
}