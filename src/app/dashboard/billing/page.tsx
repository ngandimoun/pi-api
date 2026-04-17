"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { monthlyLimitForTier } from "@/lib/pi-cli-plan-limits";
import { isPaidSubscriptionStatus } from "@/lib/subscription";
import { getSupabaseBrowser } from "@/lib/supabase-browser-client";

const TIERS = [
  { id: "starter" as const, name: "Starter", price: "$5" },
  { id: "pro" as const, name: "Pro", price: "$17" },
  { id: "enterprise" as const, name: "Enterprise", price: "$49" },
];

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>("starter");
  const [status, setStatus] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutBanner, setCheckoutBanner] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCheckoutBanner(new URLSearchParams(window.location.search).get("checkout"));
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        const meRes = await fetch("/api/dashboard/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meJson = (await meRes.json()) as {
          data?: { subscription_tier?: string; subscription_status?: string };
        };
        if (meJson.data?.subscription_tier) setTier(meJson.data.subscription_tier);
        if (meJson.data?.subscription_status) setStatus(meJson.data.subscription_status);
      }

      setLoading(false);
    })();
  }, [router]);

  async function getToken(): Promise<string | null> {
    const supabase = getSupabaseBrowser();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }

  async function startCheckout(tierId: (typeof TIERS)[number]["id"]) {
    const token = await getToken();
    if (!token) return;

    setCheckoutLoading(tierId);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier: tierId }),
      });
      const json = (await res.json()) as {
        data?: { checkout_url?: string };
        error?: { message?: string; code?: string };
      };
      if (!res.ok) {
        const code = json.error?.code;
        let message = json.error?.message ?? "Couldn’t start checkout.";
        if (code === "billing_not_configured" || code === "invalid_price") {
          message =
            "Billing isn’t fully set up yet. Add real subscription price IDs to your environment (STRIPE_PRICE_ID_* or NEXT_PUBLIC_STRIPE_PRICE_ID_* for each plan), then restart the dev server.";
        }
        alert(message);
        return;
      }
      const url = json.data?.checkout_url;
      if (url) window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn’t start checkout.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function openPortal() {
    const token = await getToken();
    if (!token) return;

    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const json = (await res.json()) as { data?: { portal_url?: string }; error?: { message?: string } };
      if (!res.ok) {
        alert(json.error?.message ?? "Couldn’t open payment settings.");
        return;
      }
      const url = json.data?.portal_url;
      if (url) window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn’t open payment settings.");
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const active = isPaidSubscriptionStatus(status);
  const limit = monthlyLimitForTier(tier);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="hidden h-4 w-px bg-border md:block" />
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <span className="text-xl" style={{ fontFamily: "serif" }}>
                π
              </span>
              <span className="text-sm font-medium uppercase tracking-wide">Pi CLI</span>
            </Link>
            <DashboardNav />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Billing</h1>
              <p className="text-sm text-muted-foreground">
                Current plan: <span className="font-medium text-foreground">{tier}</span> · Status:{" "}
                <span className="font-medium text-foreground">{status ?? "unknown"}</span> · CLI quota:{" "}
                {limit.toLocaleString()}/mo
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {checkoutBanner === "success" && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
            Checkout completed — your subscription should activate shortly. If your key was disabled, wait a few
            seconds and try <code className="rounded bg-muted px-1">pi auth login</code> again.
          </div>
        )}
        {checkoutBanner === "canceled" && (
          <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Checkout canceled — you can pick a plan anytime below.
          </div>
        )}

        {!active && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Your API key is saved here, but <strong>CLI access stays off</strong> until your subscription is
            active. Choose a plan below to turn it on.
          </div>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openPortal()}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Manage payment & invoices
          </button>
        </div>

        <h2 className="mb-4 text-lg font-semibold">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border p-6 ${tier === t.id && active ? "border-primary ring-1 ring-primary/20" : "border-border/50 bg-card"}`}
            >
              <h3 className="font-semibold">{t.name}</h3>
              <p className="mt-1 text-2xl font-bold">
                {t.price}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                ~{monthlyLimitForTier(t.id).toLocaleString()} CLI requests / month (rolling ~30 days)
              </p>
              <button
                type="button"
                onClick={() => startCheckout(t.id)}
                disabled={checkoutLoading !== null}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {checkoutLoading === t.id ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  `Subscribe — ${t.name}`
                )}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/dashboard/keys" className="text-primary underline">
            API Keys
          </Link>{" "}
          ·{" "}
          <Link href="/dashboard/usage" className="text-primary underline">
            Usage
          </Link>
        </p>
      </main>
    </div>
  );
}
