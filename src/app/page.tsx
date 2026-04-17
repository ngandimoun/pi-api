import Link from "next/link";
import { ArrowRight, Brain, Workflow, Shield } from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { TerminalDemo } from "@/components/marketing/terminal-demo";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { SectionHeading } from "@/components/marketing/section-heading";
import { DashboardCta } from "@/components/auth/dashboard-cta";

export default function Home() {
  return (
    <PageShell bg="lattice">
      <PageHero
        formula="\int_{-\infty}^{\infty} e^{-x^2}\, dx = \sqrt{\pi}"
        eyebrow="Pi CLI Hokage Edition"
        kanji="火影"
        title={
          <>
            The intelligence layer that{" "}
            <span className="ink-underline">ships your code</span>.
          </>
        }
        subtitle={
          <>
            One CLI. Every stack. From a single <code className="font-mono text-sm text-ja-shu">pi &quot;…&quot;</code> sentence to
            deterministic validation, autofix, routines, and IDE handoff.
          </>
        }
        actions={
          <>
            <DashboardCta size="lg" />
            <Link
              href="/capabilities"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              See capabilities <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
        aside={
          <TerminalDemo
            lines={[
              { kind: "cmd", text: 'pi "add Stripe checkout + Supabase webhook, then validate"' },
              { kind: "info", text: "→ detected Next.js (app router), TypeScript, Supabase" },
              { kind: "info", text: "→ omni-router → plan: routine → execute → validate" },
              { kind: "ok", text: "✓ routine.stripe-checkout-flow.v1.md generated" },
              { kind: "ok", text: "✓ 4 files written, 1 env var added" },
              { kind: "ok", text: "✓ validate passed (0 violations, 3 rules skipped via cache)" },
              { kind: "highlight", text: "ready → pi watch · pi trace · pi prompt" },
            ]}
          />
        }
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-20 md:py-28">
          <SectionHeading
            eyebrow="Three beats"
            kanji="三"
            title={
              <>
                Think. Ship. <span className="text-ja-shu">Govern.</span>
              </>
            }
            subtitle="Most AI tools stop at the suggestion. Pi CLI runs the loop — planning, writing, and proving the work."
            className="mb-14 mx-auto"
          />

          <FeatureGrid
            columns={3}
            items={[
              {
                icon: Brain,
                accent: "asagi",
                title: "Think — architect before you type",
                description: (
                  <>
                    <code className="font-mono text-xs">pi resonate</code> runs a Staff-Engineer
                    session with repo DNA from <code className="font-mono text-xs">pi learn</code>,
                    then emits a <code className="font-mono text-xs">.pi-plan.md</code> you can
                    execute step by step.
                  </>
                ),
                evidence: "packages/pi-cli/src/commands/resonate.ts",
              },
              {
                icon: Workflow,
                accent: "shu",
                title: "Ship — one command, every stack",
                description: (
                  <>
                    The omni-router turns <code className="font-mono text-xs">pi &quot;…&quot;</code>{" "}
                    into real chained subprocesses via <code className="font-mono text-xs">cli-orchestrator</code>
                    — multilingual, session-aware, polyglot-ready.
                  </>
                ),
                evidence: "packages/pi-cli/src/lib/omni-router.ts",
              },
              {
                icon: Shield,
                accent: "matcha",
                title: "Govern — deterministic + cloud",
                description: (
                  <>
                    Sharingan AST + Rasengan cache + cloud rules.{" "}
                    <code className="font-mono text-xs">pi validate</code>,{" "}
                    <code className="font-mono text-xs">pi fix</code>, pre-commit hooks, CI,
                    daemonized <code className="font-mono text-xs">pi watch</code>.
                  </>
                ),
                evidence: "packages/pi-cli/src/commands/validate.ts",
              },
            ]}
          />

        </div>
      </section>

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-20">
          <SectionHeading
            eyebrow="Identity · 位"
            kanji="位"
            title={
              <>
                Not a code generator.{" "}
                <span className="text-ja-shu">Intelligence for the ones you have.</span>
              </>
            }
            subtitle="Pi is the governance and context layer under your AI. Keep your Cursor, Claude Code, Codex CLI — Pi makes them sharper."
            className="mb-12 mx-auto"
          />

          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ja-shu">
                Category
              </p>
              <h3 className="mt-2 text-base font-semibold">Not a code generator.</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Pi governs. Your existing AI writes. Different job, different layer.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ja-asagi">
                Coexistence
              </p>
              <h3 className="mt-2 text-base font-semibold">
                Works with what you use.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Cursor, Claude Code, Codex CLI, Cline, Windsurf — Pi injects your team&apos;s DNA into all of them.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ja-matcha">
                Safety net
              </p>
              <h3 className="mt-2 text-base font-semibold">
                Catches what they miss.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Deterministic rules, watch daemon, team constitution — before CI, before review.
              </p>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/why-pi"
              className="group inline-flex items-center gap-2 text-sm font-medium text-ja-shu transition-opacity hover:opacity-80"
            >
              Read: why Pi is different
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-20">
          <div className="flex flex-wrap items-center justify-center gap-4">
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
