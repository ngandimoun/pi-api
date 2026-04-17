"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GoogleSignInButton } from "./google-signin-button";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

declare global {
  // eslint-disable-next-line no-var
  var __piSupabase: SupabaseClient | undefined;
}

function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (typeof window === "undefined") return null;
  if (!globalThis.__piSupabase) {
    globalThis.__piSupabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return globalThis.__piSupabase;
}

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-sm",
};

interface DashboardCtaProps {
  size?: Size;
  variant?: "primary" | "ghost";
  signedInLabel?: string;
  signedOutLabel?: string;
  className?: string;
  redirectTo?: string;
}

export function DashboardCta({
  size = "md",
  variant = "primary",
  signedInLabel = "Dashboard",
  signedOutLabel = "Sign in with Google",
  className = "",
  redirectTo = "/dashboard",
}: DashboardCtaProps) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setAuthed(false);
      return;
    }
    let unsubscribe: (() => void) | undefined;

    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    unsubscribe = () => listener.subscription.unsubscribe();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const base =
    variant === "primary"
      ? "inline-flex items-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      : "inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary";

  const classes = `${base} ${sizeClasses[size]} ${className}`;

  if (authed === null) {
    return (
      <span
        className={`${classes} opacity-60`}
        aria-busy="true"
        aria-label="Loading session"
      >
        <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-current" />
        <span className="invisible">{signedInLabel}</span>
      </span>
    );
  }

  if (authed) {
    return (
      <Link href={redirectTo} className={classes}>
        {signedInLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <GoogleSignInButton className={classes} redirectTo={redirectTo}>
      <span className="inline-flex items-center gap-2">
        {signedOutLabel} <ArrowRight className="h-4 w-4" />
      </span>
    </GoogleSignInButton>
  );
}
