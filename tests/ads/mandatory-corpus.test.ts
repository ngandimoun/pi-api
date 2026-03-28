import { describe, expect, it } from "vitest";

import { CorpusReferenceNotFoundError } from "@/lib/ads/retrieve-reference";

describe("mandatory corpus invariant (unit)", () => {
  it("uses deterministic error class for unresolved corpus", () => {
    const err = new CorpusReferenceNotFoundError("No corpus image reference found");
    expect(err.code).toBe("retrieval_failed");
    expect(err.name).toBe("CorpusReferenceNotFoundError");
  });
});

