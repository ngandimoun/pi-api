import { ReactNode } from "react";
import { MathBlock } from "@/components/landing/math-block";

export interface PageHeroProps {
  formula?: string;
  eyebrow?: string;
  kanji?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function PageHero({
  formula,
  eyebrow,
  kanji,
  title,
  subtitle,
  actions,
  aside,
  className = "",
}: PageHeroProps) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <div className="relative mx-auto max-w-section px-6 pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          {formula && (
            <div
              className="mb-8 text-muted-foreground/35 motion-quantum-always"
              aria-hidden="true"
            >
              <MathBlock expression={formula} display className="text-lg" />
            </div>
          )}
          {(eyebrow || kanji) && (
            <div className="mb-5 flex items-center justify-center gap-3 motion-quantum-always animation-delay-200">
              {kanji && (
                <span
                  className="font-serif text-xl text-ja-shu"
                  aria-hidden="true"
                  style={{ fontFamily: "serif" }}
                >
                  {kanji}
                </span>
              )}
              {eyebrow && <span className="ja-eyebrow">{eyebrow}</span>}
            </div>
          )}
          <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl motion-quantum-always animation-delay-400">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground motion-quantum-always animation-delay-500">
              {subtitle}
            </p>
          )}
          {actions && (
            <div className="mt-10 flex flex-wrap justify-center gap-3 motion-quantum-always animation-delay-600">
              {actions}
            </div>
          )}
        </div>
        {aside && (
          <div className="mx-auto mt-12 max-w-3xl motion-quantum-always animation-delay-800">
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
