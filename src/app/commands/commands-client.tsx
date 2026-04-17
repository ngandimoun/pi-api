"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { COMMANDS, CATEGORIES, type CommandCategory } from "@/data/commands";
import { CommandCard } from "@/components/marketing/command-card";

export function CommandsClient() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<CommandCategory | "All">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMANDS.filter((c) => {
      if (activeCat !== "All" && c.category !== activeCat) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.usage.toLowerCase().includes(q) ||
        c.aliases?.some((a) => a.toLowerCase().includes(q)) ||
        c.evidence.toLowerCase().includes(q)
      );
    });
  }, [query, activeCat]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: COMMANDS.length };
    for (const cat of CATEGORIES) {
      map[cat] = COMMANDS.filter((c) => c.category === cat).length;
    }
    return map;
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search commands, flags, or source files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-card/70 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[color:var(--ja-asagi)] focus:ring-2 focus:ring-[color:var(--ja-asagi)]/20"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} / {COMMANDS.length} commands
        </div>
      </div>

      <div className="-mx-2 flex flex-wrap gap-2">
        {(["All", ...CATEGORIES] as const).map((cat) => {
          const active = activeCat === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCat(cat as CommandCategory | "All")}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-[color:var(--ja-shu)] bg-[color:var(--ja-shu)]/10 text-ja-shu"
                  : "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {cat}
              <span className="font-mono text-[10px] text-muted-foreground/70">
                {counts[cat] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.map((c) => (
          <CommandCard
            key={c.name}
            name={c.name}
            aliases={c.aliases}
            summary={c.summary}
            usage={c.usage}
            flags={c.flags}
            example={c.example}
            evidence={c.evidence}
            accent={c.accent}
          />
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No commands match. Try another keyword or clear filters.
          </p>
        )}
      </div>
    </div>
  );
}
