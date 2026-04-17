"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  filename?: string;
  language?: string;
}

export function CodeBlock({ code, filename = "main.py", language = "python" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[var(--code-bg)] font-mono text-sm">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]/80" />
          </div>
          <span className="ml-2 text-xs text-muted-foreground">{filename}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5" /> Copied</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> Copy</>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 leading-relaxed">
        <code data-language={language}>
          {highlightCode(code, language)}
        </code>
      </pre>
    </div>
  );
}

function highlightCode(code: string, language: string) {
  const lines = code.split("\n");

  const keywords: Record<string, string[]> = {
    python: ["def", "class", "import", "from", "return", "if", "else", "for", "in", "with", "as", "async", "await", "True", "False", "None", "try", "except", "raise", "yield"],
    typescript: ["import", "from", "export", "const", "let", "var", "function", "return", "if", "else", "for", "of", "in", "async", "await", "new", "class", "interface", "type", "true", "false", "null", "undefined", "throw", "try", "catch"],
  };

  const lang = language === "ts" || language === "tsx" ? "typescript" : language;
  const kw = keywords[lang] || keywords.python;

  return lines.map((line, i) => {
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const commentMatch = lang === "python" ? remaining.match(/^(#.*)/) : remaining.match(/^(\/\/.*)/)
      if (commentMatch) {
        tokens.push(<span key={key++} className="text-[var(--code-comment)]">{commentMatch[1]}</span>);
        remaining = remaining.slice(commentMatch[1].length);
        continue;
      }

      const stringMatch = remaining.match(/^(["'`])((?:(?!\1).)*)\1/);
      if (stringMatch) {
        tokens.push(<span key={key++} className="text-[var(--code-string)]">{stringMatch[0]}</span>);
        remaining = remaining.slice(stringMatch[0].length);
        continue;
      }

      const wordMatch = remaining.match(/^([a-zA-Z_]\w*)/);
      if (wordMatch) {
        const word = wordMatch[1];
        if (kw.includes(word)) {
          tokens.push(<span key={key++} className="text-[var(--code-keyword)]">{word}</span>);
        } else {
          tokens.push(<span key={key++} className="text-[var(--code-text)]">{word}</span>);
        }
        remaining = remaining.slice(word.length);
        continue;
      }

      tokens.push(<span key={key++} className="text-[var(--code-text)]">{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }

    return (
      <span key={i} className="block">
        <span className="mr-6 inline-block w-6 select-none text-right text-[var(--code-comment)]">{i + 1}</span>
        {tokens}
      </span>
    );
  });
}
