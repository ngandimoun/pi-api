import { describe, expect, it } from "vitest";

import { scoreIntentMatch, tokenize } from "./thread-matcher.js";

describe("thread-matcher", () => {
  it("tokenize drops stop words", () => {
    expect(tokenize("we need a billing system")).toContain("billing");
    expect(tokenize("we need a billing system")).toContain("system");
  });

  it("scoreIntentMatch ranks related queries", () => {
    const s = scoreIntentMatch("billing stripe checkout", "we need a billing system", "Should we use Stripe Checkout?");
    expect(s).toBeGreaterThan(0.25);
  });
});
