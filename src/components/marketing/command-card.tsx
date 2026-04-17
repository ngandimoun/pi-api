"use client";

import { useState } from "react";
import { Copy, Check, ChevronRight } from "lucide-react";

export interface CommandCardProps {
  name: string;
  aliases?: string[];
  summary: string;
  usage: string;
  flags?: Array<{ flag: string; description: string }>;
  example?: string;
  evidence?: string;
  accent?: "shu" | "asagi" | "kincha" | "matcha" | "fuji";
}

const dotClass: Record<NonNullable<CommandCardProps["accent"]>, string> = {
  shu: "bg-[color:var(--ja-shu)]",
  asagi: "bg-[color:var(--ja-asagi)]",
  kincha: "bg-[color:var(--ja-kincha)]",
  matcha: "bg-[color:var(--ja-matcha)]",
  fuji: "bg-[color:var(--ja-fuji)]",
};

export function CommandCard({
  name,
  aliases = [],
  summary,
  usage,
  flags,
  example,
  evidence,
  accent = "shu",
}: CommandCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(usage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <article className="group rounded-xl border border-border/60 bg-card/70 transition-colors hover:border-[color:var(--ja-shu)]/40">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotClass[accent]}`}
          aria-hidden="true"
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <code className="font-mono text-sm font-semibold">{name}</code>
            {aliases.length > 0 && (
              <span className="font-mono text-[11px] text-muted-foreground/70">
                ({aliases.join(", ")})
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border/50 p-5 pt-4 space-y-4">
          <div className="relative rounded-lg border border-border/50 bg-[color:var(--code-bg)] p-3 font-mono text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copy();
              }}
              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
              aria-label="Copy command"
            >
              {copied ? <Check className="h-3 w-3 text-ja-matcha" /> : <Copy className="h-3 w-3" />}
            </button>
            <span className="text-ja-shu">$</span>{" "}
            <span className="text-[color:var(--code-text)]">{usage}</span>
          </div>

          {flags && flags.length > 0 && (
            <div>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Flags
              </h4>
              <ul className="space-y-1.5">
                {flags.map((f) => (
                  <li key={f.flag} className="flex gap-3 text-xs">
                    <code className="shrink-0 font-mono text-ja-asagi">{f.flag}</code>
                    <span className="text-muted-foreground">{f.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {example && (
            <div>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Example
              </h4>
              <pre className="whitespace-pre-wrap rounded-lg border border-border/50 bg-[color:var(--code-bg)] p-3 font-mono text-xs text-[color:var(--code-text)]">
                {example}
              </pre>
            </div>
          )}

          {evidence && (
            <p className="font-mono text-[10px] text-muted-foreground/60">
              <span className="text-ja-kincha">{"// source: "}</span>
              {evidence}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
