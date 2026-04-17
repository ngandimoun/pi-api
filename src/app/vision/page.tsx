import type { Metadata } from "next";
import { PageShell } from "@/components/marketing/page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { MathBlock } from "@/components/landing/math-block";
import { DashboardCta } from "@/components/auth/dashboard-cta";

export const metadata: Metadata = {
  title: "Vision — Pi CLI Hokage",
  description:
    "Why Pi CLI exists: an intelligence layer that closes the gap between developer intent and production code, across every stack.",
};

export default function VisionPage() {
  return (
    <PageShell bg="lattice">
      <PageHero
        formula="\pi = \lim_{n \to \infty} n \sin\!\left(\frac{180^\circ}{n}\right)"
        eyebrow="Founder's Note"
        kanji="道"
        title={<>The purpose of computing is <span className="ink-underline">insight</span>.</>}
        subtitle="And in 2026, insight without shipped code is philosophy. Pi CLI is the bridge."
      />

      <section className="relative border-t border-border/40">
        <div className="mx-auto max-w-prose px-6 py-16 md:py-24">
          <blockquote className="mb-10 border-l-2 pl-6 text-lg italic text-muted-foreground leading-relaxed" style={{ borderColor: "var(--ja-shu)" }}>
            &ldquo;The purpose of computing is insight, not numbers.&rdquo;
            <span className="mt-2 block text-sm not-italic text-muted-foreground/60">
              — Richard Hamming
            </span>
          </blockquote>

          <div className="space-y-6 text-base leading-[1.9] text-foreground/85">
            <p>
              Developers no longer ask <em>&ldquo;how smart is your AI?&rdquo;</em> — they ask
              <em> &ldquo;how fast can it ship?&rdquo;</em>. What matters now is{" "}
              <strong>output</strong>: the line from intent to implementation.
            </p>

            <p>
              LLMs gave us reasoning. Reasoning without execution is philosophy without
              practice. The next step is an{" "}
              <span className="text-ja-shu font-semibold">intelligence layer</span>{" "}
              that bridges developer intent and code reality — across every workflow,
              every stack, every team.
            </p>

            <p>That is Pi CLI.</p>

            <p>
              Just as <MathBlock expression="\pi" /> bridges the abstract and the
              geometric, Pi CLI bridges developer intelligence and real code. Not a
              chat box. Not a snippet generator. A loop.
            </p>

            <blockquote className="my-10 border-l-2 pl-6 text-lg italic text-muted-foreground leading-relaxed" style={{ borderColor: "var(--ja-asagi)" }}>
              &ldquo;What I cannot create, I do not understand.&rdquo;
              <span className="mt-2 block text-sm not-italic text-muted-foreground/60">
                — Richard Feynman
              </span>
            </blockquote>

            <h3 className="pt-4 text-xl font-semibold text-foreground">
              The decade we&apos;re building for
            </h3>

            <p>
              Every developer with an AI pair programmer that <em>ships</em>. Every
              team with governance loops that <em>hold</em>. Every codebase with a
              constitution that agents obey, not ignore.
            </p>

            <p>
              Pi CLI is the infrastructure that makes it real. Hokage Edition — the
              highest rank of ninja in a village — is our call to treat your CLI as
              the most skilled engineer on your team.
            </p>
          </div>

          <div className="mt-16 flex items-end justify-between border-t border-border/40 pt-8">
            <div>
              <p className="text-sm font-medium text-foreground">Chris NGANDIMOUN</p>
              <p className="text-xs text-muted-foreground">Founder, Pi ai</p>
              <p className="text-xs text-muted-foreground/50">March 2026</p>
            </div>
            <div className="text-muted-foreground/20" aria-hidden="true">
              <MathBlock expression="\pi" className="text-4xl" />
            </div>
          </div>

          <div className="mt-14 flex flex-wrap gap-4">
            <DashboardCta size="lg" />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
