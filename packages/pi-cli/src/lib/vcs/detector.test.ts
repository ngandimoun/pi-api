import { describe, expect, it } from "vitest";

import { createAdapterForType } from "./detector.js";

describe("createAdapterForType", () => {
  it("returns GitAdapter for git", () => {
    const a = createAdapterForType(process.cwd(), "git");
    expect(a.name).toBe("git");
    expect(a.capabilities.supportsUnifiedDiff).toBe(true);
  });

  it("returns UnknownAdapter for unknown", () => {
    const a = createAdapterForType(process.cwd(), "unknown");
    expect(a.name).toBe("unknown");
  });
});
