import { describe, expect, it } from "vitest";

import { loadBuiltInRuleDefinitions, resolveRuleStates } from "./rule-loader.js";

describe("rule-loader", () => {
  it("loads 41 built-in rule definitions", async () => {
    const defs = await loadBuiltInRuleDefinitions();
    expect(defs.length).toBe(41);
    expect(defs.some((d) => d.id === "no-hardcoded-hex")).toBe(true);
  });

  it("resolveRuleStates respects off", async () => {
    const defs = await loadBuiltInRuleDefinitions();
    const states = resolveRuleStates(defs, {
      rules: { "no-console-log": "off" },
    });
    expect(states.get("no-console-log")?.enabled).toBe(false);
  });
});
