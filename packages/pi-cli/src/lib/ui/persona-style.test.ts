import { describe, expect, it } from "vitest";

import type { PiPersona } from "../config.js";
import {
  bubbleAccent,
  defaultVerbosity,
  greetingLine,
  personaStyle,
  piLabel,
  reframeHeading,
  showPersonaTips,
} from "./persona-style.js";

const ALL_PERSONAS: PiPersona[] = ["newbie", "normal", "expert", "designer", "pm"];

describe("persona-style", () => {
  it.each(ALL_PERSONAS)("returns a complete style record for %s", (p) => {
    const s = personaStyle(p);
    expect(s.label).toBeTruthy();
    expect(s.accent).toMatch(/^(cyan|yellow|magenta|green|blue)$/);
    expect(typeof s.showDetailByDefault).toBe("boolean");
    expect(typeof s.showTips).toBe("boolean");
  });

  it("newbie persona is verbose and shows tips", () => {
    expect(defaultVerbosity("newbie")).toBe("full");
    expect(showPersonaTips("newbie")).toBe(true);
    expect(greetingLine("newbie")).not.toEqual("");
  });

  it("expert persona is compact, no greeting, no tips", () => {
    expect(defaultVerbosity("expert")).toBe("compact");
    expect(showPersonaTips("expert")).toBe(false);
    expect(greetingLine("expert")).toEqual("");
  });

  it("normal persona has no greeting but shows full detail", () => {
    expect(greetingLine("normal")).toEqual("");
    expect(defaultVerbosity("normal")).toBe("full");
  });

  it("piLabel and bubbleAccent align with personaStyle", () => {
    for (const p of ALL_PERSONAS) {
      expect(piLabel(p)).toEqual(personaStyle(p).label);
      expect(bubbleAccent(p)).toEqual(personaStyle(p).accent);
    }
  });

  describe("reframeHeading", () => {
    it("passes through canonical headings for normal/expert", () => {
      expect(reframeHeading("normal", "Invariants")).toBe("Invariants");
      expect(reframeHeading("expert", "Exit criteria")).toBe("Exit criteria");
    });

    it("reframes invariants → definition of done for pm", () => {
      expect(reframeHeading("pm", "Invariants")).toMatch(/definition of done/i);
      expect(reframeHeading("pm", "Exit criteria")).toMatch(/acceptance criteria/i);
    });

    it("reframes files → components for designer", () => {
      expect(reframeHeading("designer", "Files likely touched")).toMatch(/components|surfaces/i);
    });

    it("reframes invariants → rules for newbie", () => {
      expect(reframeHeading("newbie", "Invariants")).toMatch(/rules/i);
    });

    it("passes unknown headings through unchanged", () => {
      expect(reframeHeading("pm", "Weird heading")).toBe("Weird heading");
    });
  });
});
