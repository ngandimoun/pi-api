"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 font-mono text-xs text-muted-foreground shadow-sm backdrop-blur">
      <span className="select-none text-[10px] font-semibold tracking-wide text-foreground/60">
        npm
      </span>
      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        {command}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Copy install command"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" /> Copy
          </>
        )}
      </button>
    </div>
  );
}

