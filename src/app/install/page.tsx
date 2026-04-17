import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, User, Users, Building2 } from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { InstallationGuide } from "@/components/cli/installation-guide";
import { TerminalDemo } from "@/components/marketing/terminal-demo";
import { DashboardCta } from "@/components/auth/dashboard-cta";

export const metadata: Metadata = {
  title: "Install — Pi CLI Hokage",
  description:
    "Install Pi CLI. Solo, team, or enterprise — pick the install path, get the command, ship in minutes.",
};

const PERSONAS = [
  {
    icon: User,
    kanji: "個",
    accent: "shu" as const,
    title: "Solo",
    subtitle: "One developer. Ship faster without adopting a platform.",
    steps: [
      { kind: "cmd" as const, text: "npm i -g pi-hokage" },
      { kind: "cmd" as const, text: "pi auth-login" },
      { kind: "cmd" as const, text: "pi flow setup" },
      { kind: "ok" as const, text: "✓ ready · try pi \"…\"" },
    ],
  },
  {
    icon: Users,
    kanji: "組",
    accent: "asagi" as const,
    title: "Team",
    subtitle: "Shared system-style, generated CI, pre-commit hooks.",
    steps: [
      { kind: "cmd" as const, text: "npm i -g pi-hokage" },
      { kind: "cmd" as const, text: "pi init --with-hooks --ci github" },
      { kind: "cmd" as const, text: "pi learn && pi sync" },
      { kind: "ok" as const, text: "✓ hooks + CI wired" },
    ],
  },
  {
    icon: Building2,
    kanji: "業",
    accent: "matcha" as const,
    title: "Enterprise",
    subtitle: "Self-hosted Pi API, SSO, audit logs, private templates.",
    steps: [
      { kind: "cmd" as const, text: "PI_API_URL=https://pi.acme.internal pi init" },
      { kind: "info" as const, text: "→ env-driven, zero app-code changes" },
      { kind: "info" as const, text: "→ contact us for SSO + audit setup" },
      { kind: "ok" as const, text: "✓ ready" },
    ],
  },
];

const accentBg: Record<"shu" | "asagi" | "matcha", string> = {
  shu: "bg-[color:var(--ja-shu)]/10",
  asagi: "bg-[color:var(--ja-asagi)]/10",
  matcha: "bg-[color:var(--ja-matcha)]/10",
};
const accentText: Record<"shu" | "asagi" | "matcha", string> = {
  shu: "text-ja-shu",
  asagi: "text-ja-asagi",
  matcha: "text-ja-matcha",
};

export default function InstallPage() {
  return (
    <PageShell bg="lattice">
      <PageHero
        formula="\pi \approx 3.14159265358979"
        eyebrow="Install"
        kanji="入"
        title={<>Three minutes from <span className="ink-underline">npm</span> to <span className="ink-underline">pi flow</span>.</>}
        subtitle="Pick the path that fits your situation. Each lands you on a working, governed Pi CLI in under five minutes."
        actions={
          <>
            <DashboardCta size="lg" />
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              Full quickstart <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-20">
          <SectionHeading
            eyebrow="Pick your persona"
            kanji="人"
            title="Solo · Team · Enterprise"
            subtitle="Same CLI, different first-run rituals."
            className="mb-12 mx-auto"
          />

          <div className="grid gap-6 md:grid-cols-3">
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              return (
                <article
                  key={p.title}
                  className="flex flex-col gap-5 rounded-xl border border-border/60 bg-card/70 p-6"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${accentBg[p.accent]} ${accentText[p.accent]}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">
                        {p.title}{" "}
                        <span
                          className="ml-1 font-serif text-sm text-muted-foreground/60"
                          style={{ fontFamily: "serif" }}
                          aria-hidden="true"
                        >
                          {p.kanji}
                        </span>
                      </h3>
                      <p className="text-xs text-muted-foreground">{p.subtitle}</p>
                    </div>
                  </div>
                  <TerminalDemo lines={p.steps} className="text-[11px]" />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative border-t border-border/40">
        <InstallationGuide />
      </section>

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-20">
          <SectionHeading
            eyebrow="Next steps"
            kanji="次"
            title="Now what?"
            subtitle="The best follow-ups once pi is on your path."
            className="mb-10 mx-auto"
          />

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { href: "/capabilities", label: "Explore 15 capabilities", description: "What pi-cli actually does, with source citations." },
              { href: "/templates", label: "Browse 92 templates", description: "Import any template into .pi/routines/ with one command." },
              { href: "/commands", label: "Read the reference", description: "Searchable list of every pi command and flag." },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group rounded-xl border border-border/60 bg-card/70 p-6 transition-all hover:-translate-y-0.5 hover:border-[color:var(--ja-shu)]/40"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {c.label}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {c.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
