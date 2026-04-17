import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { DashboardCta } from "@/components/auth/dashboard-cta";

export const metadata: Metadata = {
  title: "Templates — Pi CLI Hokage",
  description:
    "Routine templates ship with pi-cli: import into .pi/routines/, compose with pi routine, and validate with pi validate.",
};

export default function TemplatesPage() {
  return (
    <PageShell bg="phase-space">
      <PageHero
        formula="\\sum_k c_k \\phi_k(x)"
        eyebrow="Routine templates"
        kanji="型"
        title={
          <>
            Curated <span className="ink-underline">templates</span> for pi-cli.
          </>
        }
        subtitle="Templates live in the pi-cli package (JSON routines). Use `pi template` after install to list, search, and import into your repo."
        actions={
          <>
            <DashboardCta size="lg" />
            <Link
              href="/install"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              Install pi-cli <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-12 md:py-20">
          <div className="mx-auto max-w-prose space-y-6 text-muted-foreground leading-relaxed">
            <p>
              The marketing catalog and API listing are served from{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground text-sm">
                /api/cli/templates
              </code>{" "}
              when the server has registry entries configured.
            </p>
            <p>
              For the full embedded library (UI/UX packs, Mastra, Stripe, LiveKit, and more), install
              the CLI and run{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground text-sm">pi template list</code>.
            </p>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
            >
              Read the docs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
