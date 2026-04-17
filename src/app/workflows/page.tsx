import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Workflow } from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { DashboardCta } from "@/components/auth/dashboard-cta";

export const metadata: Metadata = {
  title: "Workflows — Pi CLI Hokage",
  description:
    "Long-running pi-cli jobs call Pi API Mastra workflows: validate, learn, resonate, routine generation, graph builder, and GitHub PR checks.",
};

export default function WorkflowsPage() {
  return (
    <PageShell bg="ema-waves">
      <PageHero
        formula="\\Phi_{t+1} = F(\\Phi_t, \\omega)"
        eyebrow="Mastra workflows"
        kanji="流"
        title={
          <>
            Server-side <span className="ink-underline">workflows</span> for heavy CLI work.
          </>
        }
        subtitle="The CLI orchestrates local edits; Pi API runs Mastra workflows for steps that need models, storage, or policy. Poll and resume with the built-in workflow client."
        actions={
          <>
            <DashboardCta size="lg" />
            <Link
              href="/architecture"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              Architecture <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-12 md:py-20">
          <div className="mx-auto flex max-w-prose flex-col gap-6 text-muted-foreground leading-relaxed">
            <div className="flex items-center gap-3 text-foreground">
              <Workflow className="h-8 w-8" aria-hidden />
              <h2 className="text-xl font-semibold tracking-tight">Included workflow classes</h2>
            </div>
            <ul className="list-inside list-disc space-y-2 text-sm md:text-base">
              <li>Validate — AST + rules pipeline with optional patches</li>
              <li>Learn / Resonate — bounded LLM passes with governance</li>
              <li>Routine — generate and upgrade markdown routines</li>
              <li>Graph builder — dependency and blast-radius summaries</li>
              <li>GitHub PR check — tie routine drift to CI</li>
            </ul>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
            >
              Docs & env setup <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
