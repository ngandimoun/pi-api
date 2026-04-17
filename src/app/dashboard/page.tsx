"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Key, Terminal, BarChart3, Settings, LogOut, Copy, CheckCircle } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { isPaidSubscriptionStatus } from "@/lib/subscription";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
}

interface MeUsage {
  total_requests: number;
  monthly_requests: number;
  api_keys_count: number;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<MeUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [flashStatus, setFlashStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const fetchMe = useCallback(async (accessToken: string) => {
    const res = await fetch("/api/dashboard/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return;
    const json = (await res.json()) as {
      data?: UserProfile & { usage?: MeUsage };
    };
    const d = json.data;
    if (!d) return;
    const { usage: u, ...prof } = d;
    setProfile(prof as UserProfile);
    setUsage(u ?? null);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();

      if (!u) {
        router.push("/");
        return;
      }

      setUser(u);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }

      await fetchMe(token);

      // Auto-create first API key (disabled until subscription is active)
      const meRes = await fetch("/api/dashboard/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const meJson = (await meRes.json()) as {
        data?: { usage?: { api_keys_count?: number } };
      };
      const keyCount = meJson.data?.usage?.api_keys_count ?? 0;

      if (keyCount === 0) {
        const createRes = await fetch("/api/dashboard/keys", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Welcome — Pi CLI" }),
        });
        const createJson = (await createRes.json()) as {
          data?: { key?: string; key_status?: string };
        };
        if (createJson.data?.key) {
          setFlashKey(createJson.data.key);
          setFlashStatus(createJson.data.key_status ?? null);
        }
        await fetchMe(token);
      }

      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, fetchMe]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    } else {
      router.push("/");
    }
  };

  const copyFlash = async () => {
    if (!flashKey) return;
    try {
      await navigator.clipboard.writeText(flashKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 text-foreground">
                <span className="text-2xl font-light tracking-tight" style={{ fontFamily: "serif" }}>
                  π
                </span>
                <span className="text-sm font-medium uppercase tracking-wide">Pi CLI</span>
              </Link>
              <DashboardNav />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.full_name || profile.email || "Profile"}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                    <span className="text-xs font-medium text-primary">
                      {profile?.email?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <div className="hidden md:block">
                  <p className="text-sm font-medium">{profile?.full_name || "Developer"}</p>
                  <p className="text-xs text-muted-foreground">
                    {(profile?.subscription_tier || "starter") + " plan"}
                    {isPaidSubscriptionStatus(profile?.subscription_status)
                      ? ""
                      : " · billing required for CLI"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="p-2 text-muted-foreground transition-colors hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {flashKey && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">Your Pi API key</h3>
                  <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
                    {flashStatus === "disabled_pending_payment"
                      ? "Save it now — it will stay disabled until your subscription is active. Complete billing to enable CLI access."
                      : "Save this key now — it won’t be shown again."}
                  </p>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border bg-background p-3 font-mono text-sm">
                    <span className="min-w-0 flex-1 break-all">{flashKey}</span>
                    <button
                      type="button"
                      onClick={copyFlash}
                      className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Next:{" "}
                    <Link href="/dashboard/billing" className="text-primary underline">
                      Subscribe
                    </Link>{" "}
                    →{" "}
                    <Link href="/dashboard/keys" className="text-primary underline">
                      API Keys
                    </Link>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFlashKey(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}!
          </h1>
          <p className="text-muted-foreground">
            Manage your Pi CLI account, API keys, and usage analytics.
          </p>
          {usage && (
            <p className="mt-2 text-sm text-muted-foreground">
              This month:{" "}
              <span className="font-medium text-foreground">{usage.monthly_requests}</span> CLI events
              recorded ·{" "}
              <span className="font-medium text-foreground">{usage.api_keys_count}</span> API key
              {usage.api_keys_count === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">API Keys</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Generate and manage your Pi CLI API keys</p>
            <Link
              href="/dashboard/keys"
              className="block w-full rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Manage Keys
            </Link>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <Terminal className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-semibold">CLI Setup</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Install the CLI and authenticate</p>
            <Link
              href="/dashboard/keys#cli-setup"
              className="block w-full rounded-lg border border-border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-secondary"
            >
              View Guide
            </Link>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <h3 className="font-semibold">Usage Analytics</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">View usage vs your plan limits</p>
            <Link
              href="/dashboard/usage"
              className="block w-full rounded-lg border border-border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-secondary"
            >
              View Analytics
            </Link>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Settings className="h-5 w-5 text-green-500" />
              </div>
              <h3 className="font-semibold">Billing</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Subscribe and manage your plan</p>
            <Link
              href="/dashboard/billing"
              className="block w-full rounded-lg border border-border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-secondary"
            >
              Settings
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-8">
          <h2 className="mb-4 text-xl font-semibold">Get Started with Pi CLI</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-semibold text-primary">1</span>
              </div>
              <div>
                <h3 className="mb-1 font-medium">Subscribe</h3>
                <p className="text-sm text-muted-foreground">
                  Enable your API key for CLI access on the Billing page.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-semibold text-primary">2</span>
              </div>
              <div>
                <h3 className="mb-1 font-medium">Copy your API key</h3>
                <p className="text-sm text-muted-foreground">From API Keys after it is enabled.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-semibold text-primary">3</span>
              </div>
              <div>
                <h3 className="mb-1 font-medium">Install &amp; login</h3>
                <code className="mt-2 block rounded bg-muted px-2 py-1 text-sm">
                  npm install -g @pi-api/cli && pi auth login --key YOUR_API_KEY
                </code>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
