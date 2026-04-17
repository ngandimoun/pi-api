import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Download,
  KeyRound,
  Fingerprint,
  Brain,
  Blocks,
  ShieldCheck,
  ExternalLink,
  Terminal,
} from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { TerminalDemo } from "@/components/marketing/terminal-demo";
import { DashboardCta } from "@/components/auth/dashboard-cta";

export const metadata: Metadata = {
  title: "Docs — Pi CLI Hokage",
  description:
    "Pi CLI quickstart. Install, authenticate, learn your repo, architect with resonate, ship with routines, and govern with validate.",
};

const STEPS = [
  {
    icon: Download,
    kanji: "壱",
    accent: "shu" as const,
    title: "Install",
    blurb: "Hokage Edition wizard or direct npm.",
    terminal: [
      { kind: "cmd" as const, text: "npm i -g pi-hokage" },
      { kind: "info" as const, text: "→ installs @pi-api/cli + wizard" },
      { kind: "ok" as const, text: "✓ pi is on your PATH" },
    ],
  },
  {
    icon: KeyRound,
    kanji: "弐",
    accent: "asagi" as const,
    title: "Authenticate",
    blurb: "Save your Pi API key (from the dashboard).",
    terminal: [
      { kind: "cmd" as const, text: "pi auth-login" },
      { kind: "info" as const, text: "→ paste key, saved to ~/.config/pi" },
      { kind: "ok" as const, text: "✓ authenticated" },
    ],
  },
  {
    icon: Fingerprint,
    kanji: "参",
    accent: "kincha" as const,
    title: "Learn the repo",
    blurb: "Capture your codebase DNA (imports, style, secrets redacted).",
    terminal: [
      { kind: "cmd" as const, text: "pi learn --with-graph" },
      { kind: "ok" as const, text: "✓ .pi/system-style.json written" },
    ],
  },
  {
    icon: Brain,
    kanji: "肆",
    accent: "fuji" as const,
    title: "Architect first",
    blurb: "Run a Staff-Engineer session before you type code.",
    terminal: [
      { kind: "cmd" as const, text: 'pi resonate "add Stripe checkout" --plan' },
      { kind: "ok" as const, text: "✓ .pi-plan.md (6 steps)" },
    ],
  },
  {
    icon: Blocks,
    kanji: "伍",
    accent: "shu" as const,
    title: "Import a routine",
    blurb: "Pick a template from /templates and import it.",
    terminal: [
      { kind: "cmd" as const, text: "pi routine import stripe-checkout-flow" },
      { kind: "ok" as const, text: "✓ routine landed in .pi/routines/" },
    ],
  },
  {
    icon: ShieldCheck,
    kanji: "六",
    accent: "matcha" as const,
    title: "Govern",
    blurb: "Validate, fix, watch, and wire CI — one flag each.",
    terminal: [
      { kind: "cmd" as const, text: "pi flow full-check" },
      { kind: "ok" as const, text: "✓ learn · validate · fix · doctor" },
    ],
  },
];

const DEEP_LINKS = [
  {
    label: "Commands reference",
    href: "/commands",
    external: false,
    description: "All pi-cli commands with flags and examples.",
  },
  {
    label: "Architecture",
    href: "/architecture",
    external: false,
    description: "Inside the Sharingan, Rasengan, and Omni-router.",
  },
  {
    label: "Capabilities",
    href: "/capabilities",
    external: false,
    description: "The 15 ninjutsu pi-cli ships today.",
  },
  {
    label: "Conversational UX",
    href: "https://piii.mintlify.app/cli/conversational-ux",
    external: true,
    description: "How the NL omni-router and session-learning work.",
  },
  {
    label: "Mastra architecture",
    href: "https://piii.mintlify.app/cli/mastra-architecture",
    external: true,
    description: "Workflows, feature flags, polling.",
  },
  {
    label: "Task tracking",
    href: "https://piii.mintlify.app/cli/task-tracking",
    external: true,
    description: "Task trees, pi resume vs pi trace.",
  },
  {
    label: "VCS support",
    href: "https://piii.mintlify.app/cli/vcs-support",
    external: true,
    description: "Adapters: Git, Perforce, host-labeled Git.",
  },
  {
    label: "File-management",
    href: "https://piii.mintlify.app/cli/file-management-architecture",
    external: true,
    description: "Cloud vs CLI writes, .pi/ layout, IDE handoff.",
  },
  {
    label: "CI templates",
    href: "https://piii.mintlify.app/cli/ci",
    external: true,
    description: "GitHub / GitLab / Circle workflow generators.",
  },
];

const accentBg: Record<"shu" | "asagi" | "kincha" | "matcha" | "fuji", string> = {
  shu: "bg-[color:var(--ja-shu)]/10",
  asagi: "bg-[color:var(--ja-asagi)]/10",
  kincha: "bg-[color:var(--ja-kincha)]/10",
  matcha: "bg-[color:var(--ja-matcha)]/10",
  fuji: "bg-[color:var(--ja-fuji)]/10",
};
const accentText: Record<"shu" | "asagi" | "kincha" | "matcha" | "fuji", string> = {
  shu: "text-ja-shu",
  asagi: "text-ja-asagi",
  kincha: "text-ja-kincha",
  matcha: "text-ja-matcha",
  fuji: "text-ja-fuji",
};

export default function DocsPage() {
  return (
    <PageShell bg="ema-waves">
      <PageHero
        formula="e^{i\pi} + 1 = 0"
        eyebrow="Quickstart"
        kanji="書"
        title={<>Six steps from <span className="ink-underline">zero</span> to governed shipping.</>}
        subtitle={
          <>
            Deep references live on{" "}
            <a
              href="https://piii.mintlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ja-asagi underline-offset-2 hover:underline"
            >
              piii.mintlify.app
            </a>
            . This page is the shortest viable path to production.
          </>
        }
        actions={
          <>
            <DashboardCta size="lg" />
            <Link
              href="/install"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              Install Pi CLI <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="The ladder"
            kanji="順"
            title="Install → Auth → Learn → Architect → Ship → Govern"
            className="mb-14 mx-auto"
          />

          <ol className="grid gap-6 md:grid-cols-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.title}
                  className="relative rounded-xl border border-border/60 bg-card/70 p-6"
                >
                  <div className="mb-4 flex items-center gap-4">
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${accentBg[s.accent]} ${accentText[s.accent]}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Step {String(i + 1).padStart(2, "0")} · {s.kanji}
                      </p>
                      <h3 className="text-base font-semibold">{s.title}</h3>
                    </div>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">{s.blurb}</p>
                  <TerminalDemo lines={s.terminal} className="text-[11px]" />
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Deep references"
            kanji="深"
            title="Everything else lives on Mintlify"
            subtitle="Long-form, versioned, searchable. We link directly to the pages that matter."
            className="mb-14 mx-auto"
          />

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {DEEP_LINKS.map((l) => (
              <div
                key={l.label}
                className="group rounded-xl border border-border/60 bg-card/70 p-5 transition-all hover:-translate-y-0.5 hover:border-[color:var(--ja-shu)]/40"
              >
                {l.external ? (
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-semibold text-foreground"
                  >
                    <BookOpen className="h-4 w-4 text-ja-asagi" />
                    {l.label}
                    <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                  </a>
                ) : (
                  <Link
                    href={l.href}
                    className="flex items-center gap-2 text-sm font-semibold text-foreground"
                  >
                    <Terminal className="h-4 w-4 text-ja-shu" />
                    {l.label}
                    <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {l.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
