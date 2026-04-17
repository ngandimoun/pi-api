import { describe, expect, it } from "vitest";

import { buildIntentContext, classifyIntentHeuristic } from "./intent-classifier.js";

describe("classifyIntentHeuristic", () => {
  it("prefers validate for lint-like query with diff", () => {
    const ctx = {
      hasGitDiff: true,
      changedFileCount: 2,
      branch: "main",
      query: "check my changes",
      normalizedQuery: "check my changes",
    };
    const r = classifyIntentHeuristic(ctx);
    expect(r.primary).toBe("validate");
  });

  it("routes vague clean-tree intent to resonate", () => {
    const ctx = {
      hasGitDiff: false,
      changedFileCount: 0,
      branch: "main",
      query: "we need a billing system",
      normalizedQuery: "we need a billing system",
    };
    const r = classifyIntentHeuristic(ctx);
    expect(r.primary).toBe("resonate");
  });
});

describe("buildIntentContext", () => {
  it("returns structured context", async () => {
    const ctx = await buildIntentContext(process.cwd(), "hello", "hello");
    expect(typeof ctx.hasGitDiff).toBe("boolean");
    expect(ctx.query).toBe("hello");
  });
});
