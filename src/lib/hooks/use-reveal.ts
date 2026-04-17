"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Toggles `data-reveal="true"` on the returned ref when it enters the viewport.
 * Paired with CSS like `.motion-quantum` in globals.css to animate on scroll.
 *
 * Stays dependency-free (no motion lib). Respects prefers-reduced-motion via CSS.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
  { once = true }: { once?: boolean } = {},
) {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setRevealed(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setRevealed(false);
        }
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
  }, [once, options]);

  return { ref, revealed, dataReveal: revealed ? "true" : "false" } as const;
}
