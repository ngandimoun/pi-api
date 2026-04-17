/**
 * Persona-aware styling primitives consumed by `chat-ui.ts` and the resonate
 * conversation loop. Pure presentation — reads existing PiPersona but does
 * not mutate persona config.
 */

import type { PiPersona } from "../config.js";

export type PersonaStyle = {
  /** Label shown at the top of every Pi bubble. */
  label: string;
  /** Accent color (boxen + chalk) for Pi's bubble border + header. */
  accent: AccentColor;
  /** Greeting shown on the first turn of a new session (empty = none). */
  greeting: string;
  /** Whether risks / tradeoffs / claims are shown by default. */
  showDetailByDefault: boolean;
  /** Whether tips / "what this means" footer is appended. */
  showTips: boolean;
};

export type AccentColor = "cyan" | "yellow" | "magenta" | "green" | "blue";

const STYLES: Record<PiPersona, PersonaStyle> = {
  newbie: {
    label: "Pi (Senseï)",
    accent: "yellow",
    greeting:
      "Let's walk through this step by step — I'll explain the reasoning as we go.",
    showDetailByDefault: true,
    showTips: true,
  },
  normal: {
    label: "Pi (Staff Engineer)",
    accent: "cyan",
    greeting: "",
    showDetailByDefault: true,
    showTips: false,
  },
  expert: {
    label: "Pi",
    accent: "blue",
    greeting: "",
    showDetailByDefault: false,
    showTips: false,
  },
  designer: {
    label: "Pi (Design Partner)",
    accent: "magenta",
    greeting:
      "I'll frame this around user impact, visual hierarchy, and component boundaries.",
    showDetailByDefault: true,
    showTips: true,
  },
  pm: {
    label: "Pi (PM Coach)",
    accent: "green",
    greeting:
      "I'll frame this as acceptance criteria, user-visible outcomes, and risks.",
    showDetailByDefault: true,
    showTips: true,
  },
};

export function personaStyle(persona: PiPersona): PersonaStyle {
  return STYLES[persona];
}

export function piLabel(persona: PiPersona): string {
  return STYLES[persona].label;
}

export function bubbleAccent(persona: PiPersona): AccentColor {
  return STYLES[persona].accent;
}

export function greetingLine(persona: PiPersona): string {
  return STYLES[persona].greeting;
}

/**
 * Default verbosity — whether to show the full risks/tradeoffs/claims block
 * on every turn. `/verbose` and `/quiet` slash commands can override at runtime.
 */
export function defaultVerbosity(persona: PiPersona): "full" | "compact" {
  return STYLES[persona].showDetailByDefault ? "full" : "compact";
}

/** Whether to append a "what this means" tip footer. */
export function showPersonaTips(persona: PiPersona): boolean {
  return STYLES[persona].showTips;
}

/**
 * Reframe a section heading for the persona (e.g. "Invariants" → "Must-haves"
 * for newbie, or "Definition of done" for pm). Returns the canonical heading
 * unchanged for personas that don't need reframing.
 */
export function reframeHeading(persona: PiPersona, canonical: string): string {
  if (persona === "pm") {
    switch (canonical) {
      case "Invariants":
        return "Must hold (definition of done)";
      case "Exit criteria":
        return "Acceptance criteria";
      case "Risks":
        return "Business risks";
      case "Files likely touched":
        return "Surfaces affected";
    }
  }
  if (persona === "designer") {
    switch (canonical) {
      case "Files likely touched":
        return "Components / surfaces";
      case "Risks":
        return "UX risks";
    }
  }
  if (persona === "newbie") {
    switch (canonical) {
      case "Invariants":
        return "Rules we must not break";
      case "Exit criteria":
        return "How we know it's done";
    }
  }
  return canonical;
}
