"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { monthlyLimitForTier } from "@/lib/pi-cli-plan-limits";
import { isPaidSubscriptionStatus } from "@/lib/subscription";
import { getSupabaseBrowser } from "@/lib/supabase-browser-client";

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export default function UsagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [tier, setTier] = useState<string>("starter");
  const [status, setStatus] = useState<string | null>(null);
  const [byDay, setByDay] = useState<Record<string, number>>({});

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
          data?: { subscription_tier?: string; subscription_status?: string; usage?: { monthly_requests?: number } };
        };
        if (meJson.data?.subscription_tier) setTier(meJson.data.subscription_tier);
        if (meJson.data?.subscription_status) setStatus(meJson.data.subscription_status);
        if (typeof meJson.data?.usage?.monthly_requests === "number") {
          setMonthlyCount(meJson.data.usage.monthly_requests);
        }
      }

      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data: rows } = await supabase
        .from("usage_events")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      const counts: Record<string, number> = {};
      for (const r of rows ?? []) {
        const c = r.created_at as string;
        const k = dayKey(c);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      setByDay(counts);

      const { count } = await supabase
        .from("usage_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonthIso());

      if (typeof count === "number") setMonthlyCount(count);

      setLoading(false);
    })();
  }, [router]);

  const limit = monthlyLimitForTier(tier);
  const remaining = Math.max(0, limit - monthlyCount);

  const last7 = useMemo(() => {
    const out: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      out.push({ label: k, count: byDay[k] ?? 0 });
    }
    return out;
  }, [byDay]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
          </div>
          <div className="mt-4 flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Usage</h1>
              <p className="text-sm text-muted-foreground">
                CLI requests recorded this month (verify + metering). Plan limit: {limit.toLocaleString()}/mo (
                {tier}).
                {status && !isPaidSubscriptionStatus(status) ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" "}
                    Subscribe to enable keys — see Billing.
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <p className="text-sm text-muted-foreground">This month</p>
            <p className="mt-1 text-3xl font-bold">{monthlyCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">events</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <p className="text-sm text-muted-foreground">Plan limit</p>
            <p className="mt-1 text-3xl font-bold">{limit.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">per billing cycle (approx. 30d window)</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <p className="text-sm text-muted-foreground">Remaining (estimate)</p>
            <p className="mt-1 text-3xl font-bold">{remaining.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">before monthly window resets</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-6">
          <h2 className="mb-4 font-semibold">Last 7 days (by day)</h2>
          <div className="space-y-2">
            {last7.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono">{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/dashboard/billing" className="text-primary underline">
            Manage subscription
          </Link>
        </p>
      </main>
    </div>
  );
}
