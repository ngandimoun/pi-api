"use client";

import { useEffect, useState } from "react";

export interface RouteTab {
  id: string;
  label: string;
  kanji?: string;
}

export interface RouteTabsProps {
  tabs: RouteTab[];
  className?: string;
}

export function RouteTabs({ tabs, className = "" }: RouteTabsProps) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "");

  useEffect(() => {
    const sections = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <nav
      aria-label="In-page sections"
      className={`sticky top-16 z-30 -mx-6 border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl ${className}`}
    >
      <div className="mx-auto flex max-w-section items-center gap-1 overflow-x-auto py-3 scrollbar-thin">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[color:var(--ja-shu)]/10 text-ja-shu"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.kanji && (
                <span className="font-serif text-sm" style={{ fontFamily: "serif" }} aria-hidden="true">
                  {t.kanji}
                </span>
              )}
              {t.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
