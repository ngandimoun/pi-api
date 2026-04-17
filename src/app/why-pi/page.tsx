import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Bot,
  Brain,
  Plug,
  ShieldAlert,
  Lock,
  Gauge,
  Users,
  RefreshCw,
  Sparkles,
  Fingerprint,
  GitBranch,
} from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ToriiAccent } from "@/components/marketing/bg/torii-accent";
import { DashboardCta } from "@/components/auth/dashboard-cta";
import { UseCaseCard } from "./use-case-card";

export const metadata: Metadata = {
  title: "Why Pi — Governance for AI-assisted engineering",
  description:
    "Governance for AI-assisted engineering: Pi is not a replacement for your AI pair. It is the governance and context layer that makes Cursor, Claude Code, Codex CLI, Cline, and Windsurf sharper — and holds any coding agent to your team's standard.",
};

const CATEGORIES = [
  {
    icon: Code2,
    accent: "asagi" as const,
    kanji: "筆",
    label: "Code generator",
    subtitle: "The AI typing in your IDE.",
    examples: ["Cursor", "Claude Code", "Codex CLI", "GitHub Copilot"],
    blurb:
      "Writes code fast, inline, with a human in the loop. Great at the next 30 lines.",
  },
  {
    icon: Bot,
    accent: "fuji" as const,
    kanji: "走",
    label: "Coding agent",
    subtitle: "The AI running multi-step tasks in a loop.",
    examples: ["Kilo Code", "Cline", "Roo Code", "Augment Intent"],
    blurb:
      "Owns a mode, a chat, and an orchestrator. Great at autonomous multi-file work.",
  },
  {
    icon: Brain,
    accent: "shu" as const,
    kanji: "脳",
    label: "Governance layer",
    subtitle: "The governance + context layer under both.",
    examples: ["Pi Hokage"],
    blurb:
      "Repo DNA, routines, deterministic rules, watch daemon, CI, hooks. Makes everything above trustworthy. Pi can emit deterministic boilerplate from routines — it governs what the LLM writes; it does not replace your AI pair.",
  },
];

const ERROR_LAYERS = [
  {
    icon: ShieldAlert,
    kanji: "検",
    accent: "matcha" as const,
    title: "Deterministic rules",
    before: "An agent invents a new auth helper; the PR review spots it two days later.",
    after:
      "Pi's Sharingan + ts-morph rules run on your exact code and flag the duplicate at save, with a reason in plain English.",
    evidence:
      "packages/pi-cli/src/lib/ast/sharingan.ts, lib/rules/ts-morph-rules.ts",
  },
  {
    icon: Gauge,
    kanji: "見",
    accent: "asagi" as const,
    title: "Watch daemon",
    before:
      "A `any` slips into a public export and nobody notices until TypeScript in CI takes 11 minutes to tell you.",
    after:
      "`pi watch --daemon` validates only the file you just saved. The mistake is red in your terminal the same second.",
    evidence:
      "packages/pi-cli/src/commands/watch.ts, lib/watch-observability.ts",
  },
  {
    icon: Lock,
    kanji: "門",
    accent: "shu" as const,
    title: "Constitution + hooks",
    before:
      "Someone ships a new route with no rate limit; it goes live on Monday and takes the DB down on Tuesday.",
    after:
      "The pre-commit hook refuses the commit because your team's constitution requires rate-limit middleware on every public route.",
    evidence:
      "packages/pi-cli/src/lib/git-hooks-installer.ts, lib/rules/custom-rules.ts",
  },
];

const LOVE_POINTS = [
  {
    icon: Plug,
    title: "No new IDE. No new model bill.",
    detail:
      "Pi injects your team's DNA into .cursorrules, CLAUDE.md, .clinerules, and .windsurf/rules. You keep what you pay for; it just gets sharper.",
    evidence: "packages/pi-cli/src/lib/agentic-ide-injector.ts",
  },
  {
    icon: GitBranch,
    title: "Works with Git, Perforce, GitLab, Bitbucket, Gerrit.",
    detail:
      "Adapters, not assumptions. Pi runs the same way in your enterprise monorepo and your side project.",
    evidence: "packages/pi-cli/src/lib/vcs/",
  },
  {
    icon: RefreshCw,
    title: "Resumable by design.",
    detail:
      "Long tasks survive dropped connections. Task trees, workflow polling, and session stores rejoin where you left off.",
    evidence:
      "packages/pi-cli/src/lib/task-store.ts, lib/workflow-poller.ts",
  },
  {
    icon: Lock,
    title: "Secret-redacted before anything leaves the machine.",
    detail:
      "Pi learn + pi prompt apply redaction for Stripe, Pi, and generic secrets. You can ship it in regulated environments.",
    evidence: "packages/pi-cli/src/lib/privacy/redactor.ts",
  },
  {
    icon: Sparkles,
    title: "Speaks your language.",
    detail:
      "The NL router takes any-language prompts and falls back to offline heuristics when the API is unreachable.",
    evidence:
      "packages/pi-cli/src/lib/polyglot-router.ts, lib/nlp-router.ts",
  },
  {
    icon: Fingerprint,
    title: "Everything is cited.",
    detail:
      "Every capability on this site points at the real file that implements it. No invisible magic.",
    evidence: "packages/pi-cli/src/lib/",
  },
];

const accentBg = {
  shu: "bg-[color:var(--ja-shu)]/10",
  asagi: "bg-[color:var(--ja-asagi)]/10",
  kincha: "bg-[color:var(--ja-kincha)]/10",
  matcha: "bg-[color:var(--ja-matcha)]/10",
  fuji: "bg-[color:var(--ja-fuji)]/10",
} as const;
const accentText = {
  shu: "text-ja-shu",
  asagi: "text-ja-asagi",
  kincha: "text-ja-kincha",
  matcha: "text-ja-matcha",
  fuji: "text-ja-fuji",
} as const;

export default function WhyPiPage() {
  return (
    <PageShell bg="fourier">
      <PageHero
        formula="\mathbf{P} = \mathbf{C} \circ \mathbf{G}"
        eyebrow="Governance for AI-assisted engineering"
        kanji="位"
        title={
          <>
            Pi is <span className="ink-underline">not</span> another code generator.
          </>
        }
        subtitle={
          <>
            It does not replace your AI pair. It is the governance and context layer that
            makes{" "}
            <span className="text-ja-asagi">Cursor</span>,{" "}
            <span className="text-ja-asagi">Claude Code</span>,{" "}
            <span className="text-ja-asagi">Codex CLI</span>,{" "}
            <span className="text-ja-asagi">Cline</span>, and{" "}
            <span className="text-ja-asagi">Windsurf</span> sharper — and holds any coding
            agent to your team&apos;s standard.
          </>
        }
        actions={
          <>
            <DashboardCta size="lg" />
            <Link
              href="/capabilities"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              See what Pi actually does <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      {/* 1. THREE CATEGORIES */}
      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="The three categories"
            kanji="三"
            title="Code generator. Coding agent. Governance layer."
            subtitle="Most AI tools sit in the first two boxes. Pi lives in the third — deterministic boilerplate and standards that keep the first two honest. It governs what the LLM writes; it does not replace the AI pair."
            className="mb-14 mx-auto"
          />

          <div className="grid gap-6 md:grid-cols-3">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <article
                  key={c.label}
                  className="relative flex flex-col gap-4 rounded-xl border border-border/60 bg-card/70 p-6"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${accentBg[c.accent]} ${accentText[c.accent]}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {c.label} ·{" "}
                        <span
                          className="font-serif text-xs text-ja-shu/70"
                          style={{ fontFamily: "serif" }}
                          aria-hidden="true"
                        >
                          {c.kanji}
                        </span>
                      </p>
                      <h3 className="text-base font-semibold">{c.subtitle}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {c.blurb}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
                    {c.examples.map((e) => (
                      <span
                        key={e}
                        className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-10 flex items-center justify-center gap-4 text-muted-foreground">
            <ToriiAccent size={22} />
            <p className="text-sm italic">
              Every dev team needs a code generator or a coding agent.{" "}
              <span className="text-foreground font-medium">
                Pi is what keeps them honest.
              </span>
            </p>
            <ToriiAccent size={22} />
          </div>
        </div>
      </section>

      {/* 2. PI + YOUR STACK */}
      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Integration, not competition"
            kanji="繋"
            title={
              <>
                Pi makes the tools you <span className="ink-underline">already</span>{" "}
                pay for smarter.
              </>
            }
            subtitle="One command merges a marker-delimited block into every agent rules file you already use. No new IDE. No new subscription. No new chat box."
            className="mb-14 mx-auto"
          />

          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-6">
            <pre className="whitespace-pre text-xs leading-relaxed font-mono text-muted-foreground">
{`   pi learn  ──────────▶  .pi/system-style.json
                                 │
   pi routine ─────────▶  .pi/routines/<slug>/
                                 │
                                 ▼
                     agentic-ide-injector
                                 │
       ┌─────────────────────────┼─────────────────────────────┐
       ▼              ▼              ▼              ▼          ▼
   .cursorrules   CLAUDE.md   .clinerules   .windsurf/rules   AGENTS.md
       │              │              │              │          │
       ▼              ▼              ▼              ▼          ▼
    Cursor      Claude Code      Cline         Windsurf    Codex CLI`}
            </pre>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ja-shu">
                One command
              </p>
              <p className="mt-2 text-sm text-foreground font-mono">
                pi routine --inject-ide cursor,claude,cline,windsurf
              </p>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Merges only a marker-delimited block. Your existing rules are preserved.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ja-asagi">
                Your team&apos;s DNA
              </p>
              <p className="mt-2 text-sm text-foreground">
                Agents get pinned to your repo&apos;s actual imports, auth helper, and routing conventions — not a generic template.
              </p>
              <p className="mt-3 font-mono text-[10px] text-muted-foreground/60">
                // source: pi learn + .pi/system-style.json
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ja-matcha">
                Specific routines
              </p>
              <p className="mt-2 text-sm text-foreground">
                When you&apos;re shipping Stripe, the agent only sees the Stripe routine — a
                deterministic spec, not a grab-bag of unrelated templates.
              </p>
              <p className="mt-3 font-mono text-[10px] text-muted-foreground/60">
                // source: lib/agentic-ide-injector.ts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. RESPECTFUL CONTRAST */}
      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Respectful contrast"
            kanji="差"
            title="How Pi differs from Augment Code and Kilo Code"
            subtitle="Different categories, different value. Each block ends with where you'd actually use both together."
            className="mb-14 mx-auto"
          />

          <div className="grid gap-6 md:grid-cols-2">
            {/* Augment */}
            <article className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/70 p-7">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Pi vs Augment Code</h3>
                <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  category difference
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Augment&apos;s pitch is a hosted{" "}
                <span className="text-foreground">Context Engine</span> (semantic graph) +{" "}
                <span className="text-foreground">Intent</span> multi-agent workspace — &ldquo;escape the IDE&rdquo;. Pi sits a layer below.
              </p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ja-shu)]" />
                  <span>
                    <strong className="text-foreground">Local-first repo DNA.</strong>{" "}
                    <code className="font-mono text-xs">pi learn</code> writes
                    <code className="font-mono text-xs"> .pi/system-style.json</code> you
                    own, audit, and redact.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ja-asagi)]" />
                  <span>
                    <strong className="text-foreground">Cited primitives.</strong> Every
                    capability points at a real file under{" "}
                    <code className="font-mono text-xs">packages/pi-cli/src/lib/</code>.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ja-matcha)]" />
                  <span>
                    <strong className="text-foreground">Deterministic &amp; offline.</strong>{" "}
                    Sharingan AST + ts-morph rules run on save without a cloud round-trip.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ja-fuji)]" />
                  <span>
                    <strong className="text-foreground">Not a new surface.</strong> Pi
                    lives in your shell and your IDE. No separate workspace to adopt.
                  </span>
                </li>
              </ul>
              <p className="border-t border-border/40 pt-4 text-sm italic text-muted-foreground">
                <span className="text-ja-shu not-italic font-semibold">Use both.</span>{" "}
                Augment&apos;s Intent for autonomous multi-repo orchestration on a 2M-LOC
                monolith; Pi as the governance layer underneath so Intent&apos;s agents stay
                pinned to your team&apos;s constitution.
              </p>
            </article>

            {/* Kilo */}
            <article className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/70 p-7">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Pi vs Kilo Code</h3>
                <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  category difference
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Kilo is an open-source coding agent: 5 modes + Orchestrator, 500+ models
                via gateway, ROI dashboard. Pi is not a coding agent.
              </p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ja-shu)]" />
                  <span>
                    <strong className="text-foreground">No mode. No chat loop.</strong>{" "}
                    Pi orchestrates CLI subprocesses, not an agentic conversation.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ja-asagi)]" />
                  <span>
                    <strong className="text-foreground">Before and after, not during.</strong>{" "}
                    <code className="font-mono text-xs">pi learn</code> before,{" "}
                    <code className="font-mono text-xs">pi routine</code> to generate the
                    spec,{" "}
                    <code className="font-mono text-xs">pi validate</code> +{" "}
                    <code className="font-mono text-xs">pi watch</code> after.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ja-matcha)]" />
                  <span>
                    <strong className="text-foreground">Resumable, not a second chat.</strong>{" "}
                    Mastra workflow polling rejoins long runs — no second orchestrator
                    window to babysit.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ja-fuji)]" />
                  <span>
                    <strong className="text-foreground">Universal VCS.</strong> Git,
                    Perforce, GitLab, Bitbucket, Gerrit — out of the box.
                  </span>
                </li>
              </ul>
              <p className="border-t border-border/40 pt-4 text-sm italic text-muted-foreground">
                <span className="text-ja-shu not-italic font-semibold">Use both.</span>{" "}
                Let Kilo write the code. Let Pi&apos;s constitution,{" "}
                <code className="font-mono text-xs not-italic">pi watch</code>, and
                pre-commit hooks hold Kilo&apos;s output to your team standard.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* 4. FIVE USE CASES */}
      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Five stories, no code required"
            kanji="例"
            title="What Pi actually does for a team on Monday morning"
            subtitle="You don't have to be an engineer to follow these."
            className="mb-14 mx-auto"
          />

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <UseCaseCard
              icon={Sparkles}
              kanji="壱"
              accent="shu"
              title="Stripe checkout, in a day, that passes review"
              story={
                <>
                  A developer tells Pi what she wants. Pi picks the matching routine,
                  lays out the four phases, and wires pre-commit validation. She focuses
                  on the business logic; Pi checks that the webhook signature is verified
                  and the idempotency key is real.
                </>
              }
              commands={["pi routine \"add Stripe checkout + webhook\"", "pi watch"]}
              outcome="The PR lands before lunch, and review is about the pricing logic — not about missing webhook verification."
            />
            <UseCaseCard
              icon={RefreshCw}
              kanji="弐"
              accent="asagi"
              title="Upgrade auth across 80 files without a weekend panic"
              story={
                <>
                  A staff engineer asks Pi to plan the migration. Pi reads the repo&apos;s
                  DNA and writes a twelve-step plan with explicit dependencies. The team
                  walks through it, saves continuously, and the watch daemon catches each
                  regression the same second.
                </>
              }
              commands={[
                "pi resonate \"migrate Auth.js v4 to v5\"",
                "pi watch --daemon",
              ]}
              outcome="Five days, not three weeks. Nobody loses a weekend."
            />
            <UseCaseCard
              icon={Users}
              kanji="参"
              accent="matcha"
              title="A new hire ships on day one"
              story={
                <>
                  New engineer. <code className="font-mono text-xs">pi sync</code> pulls
                  the team&apos;s system-style.{" "}
                  <code className="font-mono text-xs">pi routine --show …</code> shows
                  them the exact pattern this team uses for Supabase Realtime. They skip
                  two weeks of &ldquo;figuring out how we do things here&rdquo;.
                </>
              }
              commands={["pi sync", "pi routine --show supabase-realtime-subscription"]}
              outcome="First PR merged on day one. Onboarding cost cut from weeks to hours."
            />
            <UseCaseCard
              icon={Plug}
              kanji="肆"
              accent="fuji"
              title="Keep the AI from drifting"
              story={
                <>
                  Pi injects your repo&apos;s DNA into Cursor, Claude Code, Cline, and
                  Windsurf rules files. Now the AI pair doesn&apos;t invent a new auth
                  helper — it reuses the one in{" "}
                  <code className="font-mono text-xs">src/lib/auth.ts</code> that{" "}
                  <code className="font-mono text-xs">pi learn</code> already found.
                </>
              }
              commands={["pi learn", "pi routine --inject-ide cursor,claude"]}
              outcome="Every agent you use stays on your team's rails — without a new subscription."
            />
            <UseCaseCard
              icon={ShieldAlert}
              kanji="伍"
              accent="shu"
              title="Catch the security bug before CI screams"
              story={
                <>
                  A junior pastes a raw SQL interpolation into a route. Before the save
                  animation even finishes, Pi&apos;s watch daemon flags it with a plain
                  English reason and a link to the rule.
                </>
              }
              commands={["pi watch --daemon", "pi validate"]}
              outcome="The issue is fixed in 30 seconds at the IDE, not 11 minutes later in CI."
            />
            <UseCaseCard
              icon={Gauge}
              kanji="六"
              accent="kincha"
              title="Govern without adding process"
              story={
                <>
                  A tech lead writes{" "}
                  <code className="font-mono text-xs">.pi/constitution.md</code> once:
                  rate-limit every public route, use the shared error envelope, never
                  import fetch in a server action. Pi turns it into pre-commit + CI
                  checks automatically.
                </>
              }
              commands={[
                "pi init --with-hooks --ci github",
                "pi validate",
              ]}
              outcome="The standard is enforced on every commit. No more design reviews that rediscover the same five rules."
            />
          </div>
        </div>
      </section>

      {/* 5. REWORK RECOVERY MATH */}
      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="~12 engineer-hours per week"
            kanji="算"
            title="Not a slogan. A formula you can audit."
            subtitle="Lead with a number a CFO can defend: the same four review failures recur until deterministic checks catch them before review. Below is a conservative model — swap in your own rework rate."
            className="mb-14 mx-auto"
          />

          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-7">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Step-by-step
              </h3>
              <ol className="mt-5 space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="font-mono text-ja-shu">01</span>
                  <span className="text-muted-foreground">
                    Team pushes <span className="text-foreground font-semibold">40 PRs/week</span>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-ja-shu">02</span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-semibold">25%</span> bounce on review
                    for the same four classes of mistake: hallucinated helpers, missing
                    webhook verification, N+1 queries, drifted patterns.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-ja-shu">03</span>
                  <span className="text-muted-foreground">
                    That is <span className="text-foreground font-semibold">~10 avoidable reworks/week</span> × 1.5h each
                    = <span className="text-foreground font-semibold">15h/week</span>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-ja-shu">04</span>
                  <span className="text-muted-foreground">
                    <code className="font-mono text-xs">pi validate</code> +{" "}
                    <code className="font-mono text-xs">pi watch</code> +{" "}
                    <code className="font-mono text-xs">constitution.md</code> catch three
                    of the four classes deterministically — ~<span className="text-foreground font-semibold">80% eliminated</span>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-ja-shu">05</span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-semibold">~12h/week recovered</span>,
                    with no IDE change and no new model bill.
                  </span>
                </li>
              </ol>
            </div>

            <div className="relative flex flex-col gap-6 rounded-2xl border border-border/60 bg-card/70 p-7">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Per team, per quarter
                </p>
                <p className="mt-2 font-mono text-3xl text-ja-shu">
                  12 h/wk × 13 wk = ~150 h
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Roughly four engineer-weeks reclaimed per team per quarter.
                </p>
              </div>
              <div className="border-t border-border/40 pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  What wins the budget conversation
                </p>
                <p className="mt-2 text-base text-foreground leading-relaxed">
                  <strong className="text-ja-shu">~12 hours per team per week</strong> of
                  avoidable rework pushed left — before it becomes a review comment or a CI
                  failure. That is a concrete, auditable story; it is not a magic
                  productivity multiplier.
                </p>
              </div>
              <p className="mt-auto text-xs text-muted-foreground/70">
                Numbers are a math model, not a claim we&apos;ve benchmarked for your
                team. Swap in your own rework rate to audit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW PI CATCHES ERRORS */}
      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Error catching"
            kanji="防"
            title="What Pi catches that your AI won't"
            subtitle="Three layers, each one a before/after story in plain English."
            className="mb-14 mx-auto"
          />

          <div className="grid gap-6 md:grid-cols-3">
            {ERROR_LAYERS.map((layer) => {
              const Icon = layer.icon;
              return (
                <article
                  key={layer.title}
                  className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/70 p-6"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${accentBg[layer.accent]} ${accentText[layer.accent]}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold leading-tight">
                        {layer.title}
                      </h3>
                      <p
                        className="font-serif text-xs text-muted-foreground/50"
                        style={{ fontFamily: "serif" }}
                        aria-hidden="true"
                      >
                        {layer.kanji}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/50 bg-secondary/50 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Before
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {layer.before}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[color:var(--ja-matcha)]/30 bg-[color:var(--ja-matcha)]/5 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ja-matcha">
                        With Pi
                      </p>
                      <p className="mt-1 text-xs text-foreground/90 leading-relaxed">
                        {layer.after}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/60">
                    <span className="text-ja-kincha">{"// source: "}</span>
                    {layer.evidence}
                  </p>
                </article>
              );
            })}
          </div>

          <p className="mt-12 text-center text-lg italic text-muted-foreground">
            Code generators write.{" "}
            <span className="not-italic font-semibold text-ja-shu">Pi refuses.</span>
          </p>
        </div>
      </section>

      {/* 7. WHY TEAMS LOVE IT */}
      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Why teams love it"
            kanji="愛"
            title="Six reasons, every one already true"
            subtitle="All cited against a real file. No roadmap slides."
            className="mb-14 mx-auto"
          />

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {LOVE_POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <article
                  key={p.title}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/70 p-6"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--ja-shu)]/10 text-ja-shu">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold">{p.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {p.detail}
                  </p>
                  <p className="mt-auto font-mono text-[10px] text-muted-foreground/60">
                    <span className="text-ja-kincha">{"// "}</span>
                    {p.evidence}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-4">
            <DashboardCta size="lg" />
            <Link
              href="/install"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              Install Pi CLI <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
