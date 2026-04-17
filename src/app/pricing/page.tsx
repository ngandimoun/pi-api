import type { Metadata } from "next";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PricingCards } from "@/components/pricing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing — Pi CLI Hokage",
  description:
    "Simple, transparent Pi CLI pricing — Starter, Pro, and Team tiers. Monthly CLI requests, concurrent sessions, and team seats.",
};

const FAQS = [
  {
    q: "What counts as a CLI request?",
    a: "Any command that hits the Pi API — validate, learn, routine, resonate, prompt. Local-only commands (watch, fix, doctor) are free.",
  },
  {
    q: "Do requests roll over?",
    a: "Unused requests do not roll over month to month. Pricing is designed so that typical team usage fits comfortably inside a tier.",
  },
  {
    q: "Is there a free tier?",
    a: "The CLI itself is free. You need a paid plan to use cloud validation, routine generation, and Mastra workflows. Local deterministic rules, pi watch, pi fix, and pi doctor work without a plan.",
  },
  {
    q: "Can I self-host?",
    a: "Enterprise deployments are available on request. The CLI is environment-driven and can point at a self-hosted Pi API. Contact us.",
  },
  {
    q: "How do refunds work?",
    a: "Cancel anytime. Unused time on the current billing cycle is refunded pro rata.",
  },
];

export default function PricingPage() {
  return (
    <PageShell bg="lattice">
      <PageHero
        formula="\sum_{n=0}^{\infty} \frac{(-1)^n}{2n+1} = \frac{\pi}{4}"
        eyebrow="Pricing"
        kanji="価"
        title={<>Priced like infrastructure. <span className="ink-underline">Not a SaaS tax.</span></>}
        subtitle="Pay for what the cloud does: NLP routing, validation, routine generation. Deterministic rules, watch, fix, and doctor are always local — always free."
      />

      <section className="relative border-t border-border/40">
        <PricingCards />
      </section>

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-prose px-6 py-16 md:py-20">
          <SectionHeading
            eyebrow="Questions"
            kanji="問"
            title="FAQ"
            subtitle="The questions every team asks before committing."
            align="left"
            className="mb-10"
          />
          <dl className="space-y-6">
            {FAQS.map((f) => (
              <div
                key={f.q}
                className="rounded-xl border border-border/60 bg-card/70 p-6"
              >
                <dt className="text-base font-semibold">{f.q}</dt>
                <dd className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </PageShell>
  );
}
