import type { Metadata } from "next";
import Link from "next/link";
import {
  Eye,
  CircleDot,
  Router,
  ListOrdered,
  Link2,
  Library,
  GitFork,
  Workflow,
  Shield,
  ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { DashboardCta } from "@/components/auth/dashboard-cta";

export const metadata: Metadata = {
  title: "Architecture — Pi CLI Hokage",
  description:
    "Inside pi-cli: Sharingan AST, Rasengan cache, Omni-router, Execution planner, Routine system, VCS adapters, Mastra workflow polling, Privacy redactor.",
};

export default function ArchitecturePage() {
  return (
    <PageShell bg="fourier">
      <PageHero
        formula="f(x) = \sum_{n=1}^{\infty} a_n \sin(nx) + b_n \cos(nx)"
        eyebrow="Architecture"
        kanji="構"
        title={<>Primitives beneath the <span className="ink-underline">pi</span> command.</>}
        subtitle="Every feature rides on a small set of named primitives. All open-source, all inspectable under packages/pi-cli/src/lib/."
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
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Execution pipeline"
            kanji="道"
            title="How one pi sentence becomes a shipped change"
            subtitle="Everything starts with argv. From there: translate, plan, orchestrate, validate, govern."
            className="mb-14 mx-auto"
          />

          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-6">
            <pre className="whitespace-pre text-xs leading-relaxed font-mono text-muted-foreground">
{`  argv  ─→  omni-router ─→  polyglot-router ─→  nlp-router (API)
              │                                     │ (offline fallback)
              │                                     ▼
              │                            intent-classifier
              │                                     │
              ▼                                     ▼
     session-store           ──────  execution-planner
     session-learning                          │
              │                                ▼
              │                     cli-orchestrator
              │                                │
              │       ┌─────── validate ─── sharingan · ts-morph · polyglot ── rasengan-cache
              ├──────▶│                          │                                  │
              │       ├─────── fix ─────── patch-generator ─── rules.*              │
              │       ├─────── routine ─── embedded-templates · workflow-poller     │
              │       ├─────── prompt ──── dependency-chain · prompt-cache          │
              │       ├─────── resonate ── mastra workflow · plan.md                │
              │       └─────── watch ──── chokidar · daemon · observability         │
              │                                                                     │
              ▼                                                                     ▼
     vcs adapters (git / p4 / host-labeled)           agentic-ide-injector → .cursorrules / CLAUDE.md`}
            </pre>
          </div>
        </div>
      </section>

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-16 md:py-24">
          <SectionHeading
            eyebrow="Named primitives"
            kanji="核"
            title="The nine modules that do the work"
            subtitle="Each one is swappable; none are hidden."
            className="mb-14 mx-auto"
          />

          <FeatureGrid
            items={[
              {
                icon: Router,
                accent: "shu",
                title: "Omni-router",
                description:
                  "Entry for any pi \"…\" not matching a subcommand. Translates, resumes sessions, routes via NLP or offline heuristics, chains subprocesses.",
                evidence: "packages/pi-cli/src/lib/omni-router.ts",
              },
              {
                icon: Eye,
                accent: "asagi",
                title: "Sharingan (AST)",
                description:
                  "ts-morph Project helper. In-memory blast-radius analysis from excerpts and boundary checks used by validate + doctor.",
                evidence: "packages/pi-cli/src/lib/ast/sharingan.ts",
              },
              {
                icon: CircleDot,
                accent: "kincha",
                title: "Rasengan (cache)",
                description:
                  "L1 memory + L2 disk under the .pi cache dir. Fingerprint helpers dedupe cloud validate calls and save API budget.",
                evidence: "packages/pi-cli/src/lib/cache/rasengan-cache.ts",
              },
              {
                icon: ListOrdered,
                accent: "matcha",
                title: "Execution planner",
                description:
                  "Normalizes NLP or heuristic plans into ordered steps. Enforces invariants like 'validate before fix'.",
                evidence: "packages/pi-cli/src/lib/execution-planner.ts",
              },
              {
                icon: Link2,
                accent: "fuji",
                title: "Dependency chain",
                description:
                  "Implicit preflight: ensurePiDir, shouldSyncBeforeValidate, ensureSystemStyleJson. Agents stop forgetting steps.",
                evidence: "packages/pi-cli/src/lib/dependency-chain.ts",
              },
              {
                icon: Library,
                accent: "asagi",
                title: "Routine system",
                description:
                  "Library + index + context detector. v2 markdown specs, per-phase DAG, progress JSON, drift checks against the spec.",
                evidence:
                  "packages/pi-cli/src/lib/routine-library.ts, routine-index.ts, routine-context-detector.ts",
              },
              {
                icon: GitFork,
                accent: "shu",
                title: "VCS adapters",
                description:
                  "Git, host-labeled Git (GitLab / Bitbucket / Gerrit), Perforce (p4), unknown — all via a common getPendingChanges interface.",
                evidence: "packages/pi-cli/src/lib/vcs/",
              },
              {
                icon: Workflow,
                accent: "fuji",
                title: "Mastra workflow polling",
                description:
                  "WorkflowKey union for validate / routine / resonate / learn. Polls /api/cli/workflow/poll until terminal, resumes on reconnect.",
                evidence:
                  "packages/pi-cli/src/lib/workflow-client.ts, workflow-poller.ts",
              },
              {
                icon: Shield,
                accent: "matcha",
                title: "Privacy redactor",
                description:
                  "Regex redaction for Stripe / Pi keys and generic secrets before anything leaves the machine. Applied by pi learn, pi prompt, validate.",
                evidence: "packages/pi-cli/src/lib/privacy/redactor.ts",
              },
            ]}
          />

          <div className="mt-16 rounded-2xl border border-border/60 bg-card/70 p-8">
            <h3 className="mb-4 text-lg font-semibold">Design principles</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-mono text-ja-shu">01</span>
                <span><strong className="text-foreground">Local-first.</strong> API is useful, not required — cli-capabilities banner names what degrades.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-ja-shu">02</span>
                <span><strong className="text-foreground">Cited.</strong> Every primitive has a single file of truth; no invisible magic.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-ja-shu">03</span>
                <span><strong className="text-foreground">Resumable.</strong> Task trees + workflow poller + session store survive dropped connections.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-ja-shu">04</span>
                <span><strong className="text-foreground">Safe by default.</strong> pi fix needs a confidence threshold; nothing writes outside .pi/ without you asking.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-ja-shu">05</span>
                <span><strong className="text-foreground">Polyglot.</strong> TS is first-class, but polyglot-router + VCS adapters do not assume a monoculture.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
