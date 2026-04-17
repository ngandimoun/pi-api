import { describe, expect, it } from "vitest";

import { planFromClassifier, planFromNlpPrimary } from "./execution-planner.js";
import type { ClassifiedIntent } from "./intent-classifier.js";

describe("planFromClassifier", () => {
  it("prefixes validate for fix primary", () => {
    const c: ClassifiedIntent = { primary: "fix", chain: ["fix"], confidence: 0.5 };
    const p = planFromClassifier(c, "heuristic");
    expect(p.steps).toEqual(["validate", "fix"]);
  });

  it("preserves validate-only chain", () => {
    const c: ClassifiedIntent = { primary: "validate", chain: ["validate"], confidence: 0.6 };
    const p = planFromClassifier(c, "heuristic");
    expect(p.steps).toEqual(["validate"]);
  });
});

describe("planFromNlpPrimary", () => {
  it("inserts validate before fix", () => {
    const p = planFromNlpPrimary("fix", ["fix"]);
    expect(p.steps).toEqual(["validate", "fix"]);
  });

  it("dedupes repeated steps", () => {
    const p = planFromNlpPrimary("validate", ["validate", "validate"]);
    expect(p.steps).toEqual(["validate"]);
  });
});
