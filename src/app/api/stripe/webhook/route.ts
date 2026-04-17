import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PI_CLI_DEFAULT_PRICE_IDS } from "@/lib/pi-cli-stripe-prices";
import { getStripeServer } from "@/lib/stripe-server";
import { syncUnkeyKeysForUser } from "@/lib/unkey-user-sync";

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new Error("Supabase service credentials are not configured");
    }
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  const stripe = getStripeServer();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!endpointSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      // Get the customer to find the user
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        console.error("Customer was deleted:", customerId);
        return NextResponse.json({ error: "Customer was deleted" }, { status: 400 });
      }

      const userId = customer.metadata?.user_id;
      if (!userId) {
        console.error("No user_id in customer metadata:", customerId);
        return NextResponse.json({ error: "No user_id in customer metadata" }, { status: 400 });
      }

      // Tier from env price IDs, bundled Pi CLI defaults, or recurring unit_amount (cents).
      const item0 = subscription.items.data[0];
      const rawPrice = item0?.price;
      let priceId: string | undefined;
      let unitAmount: number | null = null;
      if (rawPrice) {
        if (typeof rawPrice === "string") {
          priceId = rawPrice;
        } else {
          priceId = rawPrice.id;
          unitAmount = rawPrice.unit_amount ?? null;
        }
      }

      let tier: "starter" | "pro" | "enterprise" = "starter";
      const envPro = process.env.STRIPE_PRICE_ID_PRO;
      const envEnt = process.env.STRIPE_PRICE_ID_ENTERPRISE;
      const envStarter = process.env.STRIPE_PRICE_ID_STARTER;

      if (
        priceId === envPro ||
        priceId === PI_CLI_DEFAULT_PRICE_IDS.pro ||
        unitAmount === 1700
      ) {
        tier = "pro";
      } else if (
        priceId === envEnt ||
        priceId === PI_CLI_DEFAULT_PRICE_IDS.enterprise ||
        unitAmount === 4900
      ) {
        tier = "enterprise";
      } else if (
        priceId === envStarter ||
        priceId === PI_CLI_DEFAULT_PRICE_IDS.starter ||
        unitAmount === 500
      ) {
        tier = "starter";
      }

      const paidStatuses = new Set(["active", "trialing"]);
      const isPaid = paidStatuses.has(subscription.status);

      // Update user subscription in Supabase
      const nextStatus = !isPaid
        ? subscription.status === "past_due"
          ? "past_due"
          : "inactive"
        : subscription.status === "trialing"
          ? "trialing"
          : "active";

      const { error } = await supabase
        .from("users")
        .update({
          subscription_tier: tier,
          subscription_status: nextStatus,
          stripe_customer_id: customerId,
        })
        .eq("id", userId);

      if (error) {
        console.error("Error updating user subscription:", error);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }

      if (isPaid) {
        await syncUnkeyKeysForUser(userId, { subscriptionActive: true, tier });
      } else {
        await syncUnkeyKeysForUser(userId, { subscriptionActive: false, tier });
      }

      console.log(`Subscription ${subscription.status} for user ${userId}, tier: ${tier}`);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      // Get the customer to find the user
      const customer = await stripe.customers.retrieve(customerId);
      
      if (!customer.deleted) {
        const userId = customer.metadata?.user_id;
        if (userId) {
          // Reset user to starter plan
          const { error } = await supabase
            .from("users")
            .update({
              subscription_tier: "starter",
              subscription_status: "inactive",
            })
            .eq("id", userId);

          if (error) {
            console.error("Error updating user subscription on cancellation:", error);
            return NextResponse.json({ error: "Database update failed" }, { status: 500 });
          }

          await syncUnkeyKeysForUser(userId, { subscriptionActive: false, tier: "starter" });

          console.log(`Subscription cancelled for user ${userId}`);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      
      // Get the customer to find the user
      const customer = await stripe.customers.retrieve(customerId);
      
      if (!customer.deleted) {
        const userId = customer.metadata?.user_id;
        if (userId) {
          // Mark subscription as past due
          const { error } = await supabase
            .from("users")
            .update({
              subscription_status: "past_due",
            })
            .eq("id", userId);

          if (error) {
            console.error("Error updating user subscription on payment failure:", error);
          }

          const { data: uFail } = await supabase
            .from("users")
            .select("subscription_tier")
            .eq("id", userId)
            .single();
          await syncUnkeyKeysForUser(userId, {
            subscriptionActive: false,
            tier: (uFail?.subscription_tier as string) ?? "starter",
          });

          console.log(`Payment failed for user ${userId}`);
        }
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      
      // Get the customer to find the user
      const customer = await stripe.customers.retrieve(customerId);
      
      if (!customer.deleted) {
        const userId = customer.metadata?.user_id;
        if (userId) {
          // Mark subscription as active
          const { error } = await supabase
            .from("users")
            .update({
              subscription_status: "active",
            })
            .eq("id", userId);

          if (error) {
            console.error("Error updating user subscription on payment success:", error);
          }

          const { data: uOk } = await supabase
            .from("users")
            .select("subscription_tier")
            .eq("id", userId)
            .single();
          await syncUnkeyKeysForUser(userId, {
            subscriptionActive: true,
            tier: (uOk?.subscription_tier as string) ?? "starter",
          });

          console.log(`Payment succeeded for user ${userId}`);
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}