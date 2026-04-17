import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface FeatureItem {
  icon?: LucideIcon;
  kanji?: string;
  title: string;
  description: ReactNode;
  evidence?: string;
  accent?: "shu" | "asagi" | "kincha" | "matcha" | "fuji";
}

const accentClass: Record<NonNullable<FeatureItem["accent"]>, string> = {
  shu: "text-ja-shu",
  asagi: "text-ja-asagi",
  kincha: "text-ja-kincha",
  matcha: "text-ja-matcha",
  fuji: "text-ja-fuji",
};

const accentBgClass: Record<NonNullable<FeatureItem["accent"]>, string> = {
  shu: "bg-[color:var(--ja-shu)]/10",
  asagi: "bg-[color:var(--ja-asagi)]/10",
  kincha: "bg-[color:var(--ja-kincha)]/10",
  matcha: "bg-[color:var(--ja-matcha)]/10",
  fuji: "bg-[color:var(--ja-fuji)]/10",
};

export interface FeatureGridProps {
  items: FeatureItem[];
  columns?: 2 | 3;
  className?: string;
}

export function FeatureGrid({ items, columns = 3, className = "" }: FeatureGridProps) {
  const cols = columns === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${cols} ${className}`}>
      {items.map((f, i) => {
        const accent = f.accent ?? "shu";
        const Icon = f.icon;
        return (
          <article
            key={`${f.title}-${i}`}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-6 transition-all hover:-translate-y-0.5 hover:border-[color:var(--ja-shu)]/40 hover:shadow-sm"
          >
            <div className="mb-4 flex items-center gap-3">
              {Icon && (
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${accentBgClass[accent]} ${accentClass[accent]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              )}
              {f.kanji && !Icon && (
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg font-serif text-xl ${accentBgClass[accent]} ${accentClass[accent]}`}
                  aria-hidden="true"
                >
                  {f.kanji}
                </span>
              )}
              <h3 className="text-base font-semibold leading-tight">{f.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {f.description}
            </p>
            {f.evidence && (
              <p className="mt-4 font-mono text-[10px] text-muted-foreground/60">
                <span className="text-ja-kincha">{"// "}</span>
                {f.evidence}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
