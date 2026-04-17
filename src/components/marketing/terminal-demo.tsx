import { Terminal } from "lucide-react";
import { ReactNode } from "react";

export interface TerminalLine {
  kind?: "cmd" | "ok" | "info" | "warn" | "dim" | "highlight";
  text: ReactNode;
}

export interface TerminalDemoProps {
  title?: string;
  lines: TerminalLine[];
  className?: string;
}

const kindClass: Record<NonNullable<TerminalLine["kind"]>, string> = {
  cmd: "text-ja-matcha",
  ok: "text-ja-matcha",
  info: "text-muted-foreground",
  warn: "text-ja-kincha",
  dim: "text-muted-foreground/70",
  highlight: "text-foreground",
};

export function TerminalDemo({ title = "Terminal", lines, className = "" }: TerminalDemoProps) {
  return (
    <div
      className={`relative rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 font-mono text-sm shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-[0.2em]">{title}</span>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--ja-shu)" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--ja-kincha)" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--ja-matcha)" }} />
        </div>
      </div>
      <div className="space-y-1.5">
        {lines.map((l, i) => {
          const c = kindClass[l.kind ?? "info"];
          if (l.kind === "cmd") {
            return (
              <div key={i} className={`${c} leading-relaxed`}>
                <span className="text-ja-shu">$</span> {l.text}
                <span className="motion-caret ml-0.5">|</span>
              </div>
            );
          }
          return (
            <div key={i} className={`${c} leading-relaxed text-xs`}>
              {l.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
