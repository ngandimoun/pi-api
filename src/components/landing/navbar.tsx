"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { DashboardCta } from "@/components/auth/dashboard-cta";

const NAV_LINKS: Array<{ href: string; label: string; kanji?: string }> = [
  { href: "/vision", label: "Vision", kanji: "道" },
  { href: "/why-pi", label: "Why Pi", kanji: "位" },
  { href: "/capabilities", label: "Capabilities", kanji: "忍" },
  { href: "/commands", label: "Commands" },
  { href: "/architecture", label: "Architecture" },
  { href: "/pricing", label: "Pricing" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all ${
        scrolled
          ? "border-border/60 bg-background/85 backdrop-blur-xl"
          : "border-transparent bg-background/40 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-section items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5 text-foreground">
          <span
            className="text-2xl font-light tracking-tight transition-transform group-hover:rotate-12"
            style={{ fontFamily: "serif", color: "var(--ja-shu)" }}
          >
            &pi;
          </span>
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">
            Pi <span className="text-muted-foreground font-normal">Hokage</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.kanji && (
                  <span
                    className="font-serif text-xs text-ja-shu/70"
                    style={{ fontFamily: "serif" }}
                    aria-hidden="true"
                  >
                    {l.kanji}
                  </span>
                )}
                {l.label}
                {active && (
                  <span
                    className="absolute inset-x-3 -bottom-[3px] h-[2px] rounded-full"
                    style={{ background: "var(--ja-shu)" }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
          <Link
            href="/docs"
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:block">
            <DashboardCta size="sm" />
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((s) => !s)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-section flex-col gap-1 px-6 py-4">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  isActive(l.href)
                    ? "bg-[color:var(--ja-shu)]/10 text-ja-shu"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {l.kanji && (
                  <span
                    className="font-serif text-xs text-ja-shu/70"
                    style={{ fontFamily: "serif" }}
                    aria-hidden="true"
                  >
                    {l.kanji}
                  </span>
                )}
                {l.label}
              </Link>
            ))}
            <Link
              href="/docs"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
            >
              Docs
            </Link>
            <div className="mt-3 sm:hidden">
              <DashboardCta size="md" className="w-full justify-center" />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
