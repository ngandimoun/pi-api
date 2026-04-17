import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isPiPersona, PERSONA_IDS, type PiPersona } from "./config.js";
import { formatCommandHint, getPersonaInstructions, listPersonas, PERSONAS } from "./persona.js";

const ORIGINAL_ENV = process.env.PI_PERSONA;

describe("PERSONA_IDS", () => {
  it("contains exactly the five ship-v1 personas", () => {
    expect([...PERSONA_IDS].sort()).toEqual(
      ["designer", "expert", "newbie", "normal", "pm"].sort(),
    );
  });
});

describe("isPiPersona", () => {
  it("accepts every shipped persona id", () => {
    for (const id of PERSONA_IDS) {
      expect(isPiPersona(id)).toBe(true);
    }
  });

  it("rejects unknown strings, empty, and non-strings", () => {
    expect(isPiPersona("junior")).toBe(false);
    expect(isPiPersona("")).toBe(false);
    expect(isPiPersona(undefined)).toBe(false);
    expect(isPiPersona(42)).toBe(false);
  });
});

describe("PERSONAS metadata", () => {
  it("provides a non-empty label + description for every persona", () => {
    for (const meta of listPersonas()) {
      expect(meta.id).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.longLabel.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("PERSONAS and listPersonas() stay in sync", () => {
    const viaList = listPersonas().map((m) => m.id).sort();
    const viaKeys = Object.keys(PERSONAS).sort();
    expect(viaList).toEqual(viaKeys);
  });
});

describe("getPersonaInstructions", () => {
  it("returns a tagged, non-empty instruction block for every persona", () => {
    for (const id of PERSONA_IDS) {
      const instr = getPersonaInstructions(id);
      expect(instr.length).toBeGreaterThan(40);
      expect(instr).toContain(`[PI PERSONA: ${id}]`);
    }
  });

  it("produces distinct instructions per persona (no copy-paste)", () => {
    const seen = new Set<string>();
    for (const id of PERSONA_IDS) {
      seen.add(getPersonaInstructions(id));
    }
    expect(seen.size).toBe(PERSONA_IDS.length);
  });
});

describe("formatCommandHint", () => {
  const cmd = "npm run dev";
  const purpose = "start the Next.js dev server";

  it("newbie adds an explanation line and an expected-outcome line", () => {
    const out = formatCommandHint("newbie", cmd, purpose);
    expect(out).toContain(cmd);
    expect(out).toContain("what it does");
    expect(out).toContain("you should see");
  });

  it("expert is terse (single line, no explanation prose)", () => {
    const out = formatCommandHint("expert", cmd, purpose);
    expect(out).toContain(cmd);
    expect(out).not.toContain("what it does");
    expect(out.split("\n").length).toBe(1);
  });

  it("designer and pm tag their hints with domain framing", () => {
    expect(formatCommandHint("designer", cmd, purpose)).toContain("UI/UX");
    expect(formatCommandHint("pm", cmd, purpose)).toContain("user-facing outcome");
  });

  it("normal sits between newbie and expert (one-line with purpose)", () => {
    const out = formatCommandHint("normal", cmd, purpose);
    expect(out).toContain(cmd);
    expect(out).toContain(purpose);
    expect(out.split("\n").length).toBe(1);
  });
});

describe("getPersona resolution order (env > store > default)", () => {
  // Env-based resolution is the only branch we can test without touching the
  // user's real ~/.config/pi store; global-store isolation would need a conf
  // mock. The resolution order itself is covered by reading the function below.

  beforeEach(() => {
    delete process.env.PI_PERSONA;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.PI_PERSONA;
    } else {
      process.env.PI_PERSONA = ORIGINAL_ENV;
    }
  });

  it("env override beats project override and default", async () => {
    const { getPersona } = await import("./config.js");
    for (const id of PERSONA_IDS) {
      process.env.PI_PERSONA = id;
      const projectOverride: PiPersona = id === "normal" ? "expert" : "normal";
      expect(getPersona(projectOverride)).toBe(id);
    }
  });

  it("project override is used when env is absent", async () => {
    const { getPersona } = await import("./config.js");
    delete process.env.PI_PERSONA;
    expect(getPersona("designer")).toBe("designer");
  });

  it("falls back to 'normal' when env is unknown and no project override", async () => {
    const { getPersona } = await import("./config.js");
    process.env.PI_PERSONA = "junior";
    // Not relying on an empty store (user may have one); just assert it is a
    // valid persona id — the unknown env value must never leak through.
    const resolved = getPersona();
    expect(isPiPersona(resolved)).toBe(true);
    expect(resolved).not.toBe("junior" as unknown as PiPersona);
  });
});
