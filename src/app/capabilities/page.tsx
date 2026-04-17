import type { Metadata } from "next";
import Link from "next/link";
import {
  Sparkles,
  Languages,
  Fingerprint,
  Brain,
  Clipboard,
  Network,
  ShieldCheck,
  Wrench,
  Eye,
  GitBranch,
  RefreshCw,
  GitCommitHorizontal,
  Gauge,
  Blocks,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { TerminalDemo } from "@/components/marketing/terminal-demo";
import { DashboardCta } from "@/components/auth/dashboard-cta";

export const metadata: Metadata = {
  title: "Capabilities — Pi CLI Hokage",
  description:
    "Fifteen real capabilities of pi-cli: omni-router NL entry, repo-DNA learn, resonate architect sessions, routine v2, deterministic validation, watch daemon, universal VCS, IDE injection, and more.",
};

const CAPS = [
  {
    icon: Sparkles,
    kanji: "命",
    accent: "shu" as const,
    title: "Natural-language entry — pi \"…\"",
    blurb:
      "If your first argv isn't a known subcommand, the omni-router translates it, resumes any matching session, then chains real subprocesses (validate → fix → prompt). No chat-box trap.",
    evidence: "packages/pi-cli/src/lib/omni-router.ts",
    demo: [
      { kind: "cmd" as const, text: 'pi "fix the lint warnings and re-run validate"' },
      { kind: "info" as const, text: "→ planFromNlpPrimary: validate → fix" },
      { kind: "ok" as const, text: "✓ validate: 4 → 0 violations" },
      { kind: "ok" as const, text: "✓ fix applied: 4 patches, confidence >= 0.85" },
    ],
  },
  {
    icon: Languages,
    kanji: "言",
    accent: "asagi" as const,
    title: "Multilingual, offline-tolerant routing",
    blurb:
      "polyglot-router calls the Pi API for plans; on failure it falls back to an offline envelope so intent-classifier heuristics still dispatch commands from any language.",
    evidence: "packages/pi-cli/src/lib/polyglot-router.ts, nlp-router.ts",
    demo: [
      { kind: "cmd" as const, text: 'pi "lance une vérification et corrige les erreurs"' },
      { kind: "info" as const, text: "→ locale: fr · normalized: validate + fix" },
      { kind: "ok" as const, text: "✓ routed to offline heuristic (API offline)" },
    ],
  },
  {
    icon: Fingerprint,
    kanji: "種",
    accent: "kincha" as const,
    title: "pi learn — repo DNA",
    blurb:
      "Scans TS/JS (chunked for big repos), builds import histograms, collects polyglot hints, redacts secrets, and persists a team-shareable system-style fingerprint.",
    evidence: "packages/pi-cli/src/commands/learn.ts, lib/privacy/redactor.ts",
    demo: [
      { kind: "cmd" as const, text: "pi learn --with-graph" },
      { kind: "info" as const, text: "→ scanRepoInChunks: 847 files in 12 batches" },
      { kind: "ok" as const, text: "✓ .pi/system-style.json written, secrets redacted" },
    ],
  },
  {
    icon: Brain,
    kanji: "想",
    accent: "fuji" as const,
    title: "pi resonate — Staff-Engineer session",
    blurb:
      "Multi-turn architecture mode with repo DNA, git context, pattern recall, optional Mastra workflow, and emits .pi-plan.md you can execute step by step.",
    evidence: "packages/pi-cli/src/commands/resonate.ts",
    demo: [
      { kind: "cmd" as const, text: 'pi resonate "break up the monolithic checkout service"' },
      { kind: "info" as const, text: "→ staged → deep, recalling 3 past patterns" },
      { kind: "ok" as const, text: "✓ .pi/resonance/checkout-split-2026-04-17.md" },
      { kind: "ok" as const, text: "✓ .pi-plan.md (8 steps) ready for pi execute" },
    ],
  },
  {
    icon: Clipboard,
    kanji: "写",
    accent: "asagi" as const,
    title: "pi prompt — codebase-aware prompt compiler",
    blurb:
      "Runs preflight (dependency-chain), calls the API for a paste-ready prompt with your actual imports and patterns, caches, diffs against last run, copies to clipboard.",
    evidence: "packages/pi-cli/src/commands/prompt.ts",
    demo: [
      { kind: "cmd" as const, text: 'pi p "refactor auth context to Supabase SSR"' },
      { kind: "info" as const, text: "→ context quality: 94% (style + graph attached)" },
      { kind: "ok" as const, text: "✓ cached to .pi/prompt-cache/auth-ssr.md, copied" },
    ],
  },
  {
    icon: Blocks,
    kanji: "型",
    accent: "shu" as const,
    title: "pi routine v2 — specs with progressive handoff",
    blurb:
      "Generates versioned routine markdown (slug.vN.md), per-phase folders (.dag.json / .progress.json), and pi routine next advances phases as work lands.",
    evidence: "packages/pi-cli/src/commands/routine.ts, routine-next.ts",
    demo: [
      { kind: "cmd" as const, text: 'pi routine "ship Stripe checkout + webhook"' },
      { kind: "ok" as const, text: "✓ stripe-checkout-flow.v1.md (4 phases)" },
      { kind: "cmd" as const, text: "pi routine next" },
      { kind: "info" as const, text: "→ phase 2/4: webhook signature verification" },
    ],
  },
  {
    icon: ShieldCheck,
    kanji: "検",
    accent: "matcha" as const,
    title: "pi validate — deterministic + cloud",
    blurb:
      "Sharingan/ts-morph built-ins, project rules, polyglot scans. Merges with cloud validation, caches via Rasengan, supports --hunks-only and --async for big repos.",
    evidence: "packages/pi-cli/src/commands/validate.ts",
    demo: [
      { kind: "cmd" as const, text: "pi validate --hunks-only --async" },
      { kind: "info" as const, text: "→ 128 hunks across 23 files · workflow polling" },
      { kind: "ok" as const, text: "✓ 0 violations · 42 rules ran · 18 served from cache" },
    ],
  },
  {
    icon: Wrench,
    kanji: "修",
    accent: "shu" as const,
    title: "pi fix — safe, interactive autofix",
    blurb:
      "Same rule engine as validate. Generates deterministic patches, filters by confidence, lets you apply interactively. No rogue AI rewrites.",
    evidence: "packages/pi-cli/src/commands/fix.ts, lib/rules/patch-generator.ts",
    demo: [
      { kind: "cmd" as const, text: "pi fix --interactive --min-confidence 0.9" },
      { kind: "ok" as const, text: "✓ 6/8 patches applied (2 skipped)" },
    ],
  },
  {
    icon: Eye,
    kanji: "見",
    accent: "asagi" as const,
    title: "pi watch — governance on save",
    blurb:
      "Chokidar + daemon mode, PID lock, heartbeat, rotating logs. Validates only changed files on each save — your IDE with guardrails.",
    evidence: "packages/pi-cli/src/commands/watch.ts, lib/watch-observability.ts",
    demo: [
      { kind: "cmd" as const, text: "pi watch --daemon" },
      { kind: "info" as const, text: "→ daemon started · pid 14382 · logs .pi/watch.log" },
      { kind: "ok" as const, text: "✓ src/app/checkout/page.tsx — 0 violations" },
    ],
  },
  {
    icon: GitBranch,
    kanji: "枝",
    accent: "fuji" as const,
    title: "Universal VCS — Git, Perforce, GitLab, more",
    blurb:
      "Adapter cache with getPendingChanges / getChangedHunksLegacy. Host-labeled Git (GitLab / Bitbucket / Gerrit), Perforce (p4), unknown adapters all work.",
    evidence: "packages/pi-cli/src/lib/vcs/index.ts",
    demo: [
      { kind: "cmd" as const, text: "pi vcs" },
      { kind: "info" as const, text: "→ type: git · host: gitlab · capabilities: hunks, stash" },
    ],
  },
  {
    icon: RefreshCw,
    kanji: "続",
    accent: "kincha" as const,
    title: "Sessions, tasks, resume",
    blurb:
      "Every command records a task tree. pi resume rejoins any in-flight workflow; pi trace fetches workflow snapshots; session-store pins transcripts per cwd.",
    evidence: "packages/pi-cli/src/lib/task-store.ts, session-store.ts",
    demo: [
      { kind: "cmd" as const, text: "pi tasks tree" },
      { kind: "info" as const, text: "└─ validate · run_abc123 · suspended" },
      { kind: "cmd" as const, text: "pi resume abc123" },
    ],
  },
  {
    icon: GitCommitHorizontal,
    kanji: "門",
    accent: "matcha" as const,
    title: "Git hooks + CI generator",
    blurb:
      "git-hooks-installer wires pre-commit / pre-push pi validate. ci-generator emits GitHub / GitLab / Circle workflows with .pi cache and monorepo env hints.",
    evidence: "packages/pi-cli/src/lib/git-hooks-installer.ts, ci-generator.ts",
    demo: [
      { kind: "cmd" as const, text: "pi init --with-hooks --ci github" },
      { kind: "ok" as const, text: "✓ .git/hooks/pre-commit installed" },
      { kind: "ok" as const, text: "✓ .github/workflows/pi-routine-check.yml" },
    ],
  },
  {
    icon: Network,
    kanji: "繋",
    accent: "asagi" as const,
    title: "Agentic IDE injection",
    blurb:
      "Merges a marker-delimited block into .cursorrules, CLAUDE.md, .clinerules, .windsurf/rules. Pins agents to your system-style and specific routine paths (not the whole library).",
    evidence: "packages/pi-cli/src/lib/agentic-ide-injector.ts",
    demo: [
      { kind: "cmd" as const, text: "pi routine --inject-ide cursor,claude" },
      { kind: "ok" as const, text: "✓ merged block into .cursorrules + CLAUDE.md" },
    ],
  },
  {
    icon: Gauge,
    kanji: "流",
    accent: "fuji" as const,
    title: "pi flow — named pipelines",
    blurb:
      "setup, check-and-fix, full-check. Chains init / sync / learn / validate / fix / resonate / doctor in a single command with sensible defaults.",
    evidence: "packages/pi-cli/src/commands/flow.ts",
    demo: [
      { kind: "cmd" as const, text: "pi flow full-check" },
      { kind: "info" as const, text: "→ learn → validate → fix → doctor" },
      { kind: "ok" as const, text: "✓ all 4 stages green" },
    ],
  },
  {
    icon: Stethoscope,
    kanji: "診",
    accent: "shu" as const,
    title: "pi doctor — readiness report",
    blurb:
      "Aggregates API health, .pi artifacts, polyglot hints, Sharingan boundary demo, hooks / CI detection, watch status. --fix runs remediation inline.",
    evidence: "packages/pi-cli/src/commands/doctor.ts",
    demo: [
      { kind: "cmd" as const, text: "pi doctor --fix" },
      { kind: "info" as const, text: "→ 12/12 checks · 1 auto-fixed (missing .pi/config.json)" },
    ],
  },
];

export default function CapabilitiesPage() {
  return (
    <PageShell bg="field-lines">
      <PageHero
        formula="\nabla \cdot \mathbf{F} = \frac{\rho}{\varepsilon_0}"
        eyebrow="Capabilities · Nin"
        kanji="忍"
        title={<>Fifteen ninjutsu pi-cli already ships.</>}
        subtitle={
          <>
            Every capability below is <span className="text-ja-shu font-semibold">cited</span>{" "}
            against the actual file that implements it. No roadmap slides — code you can
            run today.
          </>
        }
        actions={
          <>
            <DashboardCta size="lg" />
            <Link
              href="/commands"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              Full command reference <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="15 ninjutsu · source-cited"
            kanji="術"
            title="What pi-cli actually does"
            subtitle="Not 'code understanding'. Real plan → run → prove loops with evidence."
            className="mb-14 mx-auto"
          />

          <div className="grid gap-6 md:grid-cols-2">
            {CAPS.map((c) => {
              const Icon = c.icon;
              const accentBg: Record<typeof c.accent, string> = {
                shu: "bg-[color:var(--ja-shu)]/10",
                asagi: "bg-[color:var(--ja-asagi)]/10",
                kincha: "bg-[color:var(--ja-kincha)]/10",
                matcha: "bg-[color:var(--ja-matcha)]/10",
                fuji: "bg-[color:var(--ja-fuji)]/10",
              };
              const accentText: Record<typeof c.accent, string> = {
                shu: "text-ja-shu",
                asagi: "text-ja-asagi",
                kincha: "text-ja-kincha",
                matcha: "text-ja-matcha",
                fuji: "text-ja-fuji",
              };
              return (
                <article
                  key={c.title}
                  className="group flex flex-col gap-5 rounded-xl border border-border/60 bg-card/70 p-6 transition-colors hover:border-[color:var(--ja-shu)]/40"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accentBg[c.accent]} ${accentText[c.accent]}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-base font-semibold leading-tight">
                          {c.title}
                        </h3>
                        <span
                          className="font-serif text-sm text-muted-foreground/50"
                          style={{ fontFamily: "serif" }}
                          aria-hidden="true"
                        >
                          {c.kanji}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {c.blurb}
                      </p>
                    </div>
                  </div>
                  <TerminalDemo lines={c.demo} className="text-[11px]" />
                  <p className="font-mono text-[10px] text-muted-foreground/60">
                    <span className="text-ja-kincha">{"// source: "}</span>
                    {c.evidence}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-4">
            <DashboardCta size="lg" />
            <Link
              href="/architecture"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              See the architecture <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
