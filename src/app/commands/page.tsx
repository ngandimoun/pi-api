import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { DashboardCta } from "@/components/auth/dashboard-cta";
import { CommandsClient } from "./commands-client";

export const metadata: Metadata = {
  title: "Commands — Pi CLI Hokage",
  description:
    "Searchable reference for every pi-cli command: entry, context, plan, ship, govern, automate, ops, account. Each entry cites its source file.",
};

export default function CommandsPage() {
  return (
    <PageShell bg="grid-engawa">
      <PageHero
        formula="\tau = 2\pi"
        eyebrow="Command Reference"
        kanji="令"
        title={<>Every <span className="ink-underline">pi</span> command, searchable.</>}
        subtitle="Each row cites the exact source file in packages/pi-cli/. Click to expand for flags + real examples."
        actions={
          <>
            <DashboardCta size="lg" />
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-8 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              Docs & quickstart <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-section px-6 py-12 md:py-20">
          <CommandsClient />
        </div>
      </section>
    </PageShell>
  );
}
