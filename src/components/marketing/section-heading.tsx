import { ReactNode } from "react";
import { MathBlock } from "@/components/landing/math-block";

export interface SectionHeadingProps {
  eyebrow?: string;
  kanji?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  formula?: string;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  kanji,
  title,
  subtitle,
  formula,
  align = "center",
  className = "",
}: SectionHeadingProps) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left items-start";
  return (
    <div className={`flex flex-col gap-4 ${alignClass} ${className}`}>
      {formula && (
        <div className="text-muted-foreground/30" aria-hidden="true">
          <MathBlock expression={formula} display />
        </div>
      )}
      {(eyebrow || kanji) && (
        <div className="flex items-center gap-3">
          {kanji && (
            <span
              className="font-serif text-lg text-ja-shu"
              aria-hidden="true"
              style={{ fontFamily: "serif" }}
            >
              {kanji}
            </span>
          )}
          {eyebrow && <span className="ja-eyebrow">{eyebrow}</span>}
        </div>
      )}
      <h2 className="text-3xl font-bold tracking-tight md:text-5xl text-balance">
        {title}
      </h2>
      {subtitle && (
        <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
