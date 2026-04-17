import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface UseCaseCardProps {
  icon: LucideIcon;
  kanji: string;
  accent: "shu" | "asagi" | "kincha" | "matcha" | "fuji";
  title: string;
  story: ReactNode;
  commands: string[];
  outcome: ReactNode;
}

const accentBg = {
  shu: "bg-[color:var(--ja-shu)]/10",
  asagi: "bg-[color:var(--ja-asagi)]/10",
  kincha: "bg-[color:var(--ja-kincha)]/10",
  matcha: "bg-[color:var(--ja-matcha)]/10",
  fuji: "bg-[color:var(--ja-fuji)]/10",
} as const;
const accentText = {
  shu: "text-ja-shu",
  asagi: "text-ja-asagi",
  kincha: "text-ja-kincha",
  matcha: "text-ja-matcha",
  fuji: "text-ja-fuji",
} as const;

export function UseCaseCard({
  icon: Icon,
  kanji,
  accent,
  title,
  story,
  commands,
  outcome,
}: UseCaseCardProps) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/70 p-6 transition-colors hover:border-[color:var(--ja-shu)]/40">
      <div className="flex items-start gap-4">
        <div
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accentBg[accent]} ${accentText[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-semibold leading-tight">{title}</h3>
            <span
              className="font-serif text-sm text-muted-foreground/50"
              aria-hidden="true"
              style={{ fontFamily: "serif" }}
            >
              {kanji}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{story}</p>

      <div className="flex flex-wrap gap-1.5">
        {commands.map((c) => (
          <code
            key={c}
            className="rounded-md border border-border/50 bg-[color:var(--code-bg)] px-2 py-0.5 font-mono text-[11px] text-[color:var(--code-text)]"
          >
            {c}
          </code>
        ))}
      </div>

      <p className="border-t border-border/40 pt-3 text-xs text-foreground/80">
        <span className="font-semibold text-ja-matcha">Outcome.</span> {outcome}
      </p>
    </article>
  );
}
