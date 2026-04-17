import { Navbar } from "@/components/landing/navbar";
import { MathBlock } from "@/components/landing/math-block";
import { Footer } from "@/components/landing/footer";
import { KeysClient } from "@/app/keys/keys-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get API Key — Pi APIs",
  description:
    "Generate a free Pi API key. No dashboard required — create your key and start calling Pi APIs immediately.",
};

export default function KeysPage() {
  return (
    <>
      <Navbar />
      <main className="relative overflow-hidden pt-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <section className="relative mx-auto max-w-section px-6 py-16 md:py-24">
          <div className="mx-auto max-w-prose">
            <div className="mb-10 text-center text-muted-foreground/30 animate-fade-in-up">
              <MathBlock
                expression="\int_{0}^{1} \frac{4}{1+x^2}\, dx = \pi"
                display
                className="text-xl"
              />
            </div>

            <h1 className="text-center text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl animate-fade-in-up animation-delay-200">
              Get your Pi API key
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-center text-lg text-muted-foreground leading-relaxed animate-fade-in-up animation-delay-400">
              Pi APIs are free right now. Generate a key, copy it once, and start
              shipping.
            </p>

            <div className="mt-10 animate-fade-in-up animation-delay-600">
              <KeysClient />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

