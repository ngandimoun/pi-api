"use client";

import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const PRICING_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: 5,
    description: "Perfect for individual developers getting started with AI-powered development",
    features: [
      "1,000 CLI requests/month",
      "1 concurrent session",
      "All templates + custom",
      "Community support",
      "1 team member",
    ],
    cta: "Start Building",
    popular: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER,
  },
  {
    id: "pro",
    name: "Pro",
    price: 17,
    description: "Ideal for growing teams and serious development workflows",
    features: [
      "10,000 CLI requests/month",
      "3 concurrent sessions",
      "All templates + custom",
      "Email support",
      "5 team members",
    ],
    cta: "Scale Up",
    popular: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 49,
    description: "For teams that need maximum performance and priority support",
    features: [
      "100,000 CLI requests/month",
      "10 concurrent sessions", 
      "All templates + custom",
      "Priority support",
      "Unlimited team members",
    ],
    cta: "Go Enterprise",
    popular: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE,
  },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function PricingCards() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tier: typeof PRICING_TIERS[0]) => {
    setLoadingTier(tier.id);

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to sign up
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/dashboard?plan=${tier.id}`,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });
        
        if (error) {
          console.error("Auth error:", error);
        }
        return;
      }

      // Get user session for API calls
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        console.error("No session token");
        return;
      }

      // Create checkout session
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier: tier.id }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data.checkout_url) {
          window.location.href = result.data.checkout_url;
        }
      } else {
        let message = "Couldn’t start checkout.";
        try {
          const errBody = (await response.json()) as {
            error?: { message?: string; code?: string };
          };
          if (errBody.error?.code === "billing_not_configured" || errBody.error?.code === "invalid_price") {
            message =
              "Billing isn’t fully set up for this site yet. Ask the team to add subscription price IDs to the server environment.";
          } else if (typeof errBody.error?.message === "string") {
            message = errBody.error.message;
          }
        } catch {
          /* ignore */
        }
        console.error("Checkout failed:", message);
        alert(message);
      }
    } catch (error) {
      console.error("Subscription error:", error);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <section id="pricing" className="relative border-t border-border/50">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-section px-6 py-20 md:py-28">
        <div className="mx-auto max-w-prose text-center">
          <div className="mb-6 text-muted-foreground/20">
            <span className="text-2xl">
              ∑<sub>n=0</sub><sup>∞</sup> (-1)<sup>n</sup>/(2n+1) = π/4
            </span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the plan that scales with your development velocity. All plans include access to our complete template library and custom implementations.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-8 ${
                tier.popular
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/50 bg-card"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${tier.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tier.description}
                </p>
              </div>

              <ul className="mb-8 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier)}
                disabled={loadingTier === tier.id}
                className={`w-full rounded-xl px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  tier.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border bg-background hover:bg-secondary"
                } ${loadingTier === tier.id ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {loadingTier === tier.id ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {tier.cta} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include a 7-day free trial. No credit card required to start.
          </p>
        </div>
      </div>
    </section>
  );
}