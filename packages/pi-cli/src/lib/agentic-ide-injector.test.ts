import { describe, expect, it } from "vitest";

import { mergePiManagedSection, PI_CLI_MARK_END, PI_CLI_MARK_START } from "./agentic-ide-injector.js";

describe("mergePiManagedSection", () => {
  it("appends block when markers absent", () => {
    const out = mergePiManagedSection("# Hello\n", "BODY");
    expect(out).toContain("# Hello");
    expect(out).toContain(PI_CLI_MARK_START);
    expect(out).toContain("BODY");
    expect(out).toContain(PI_CLI_MARK_END);
  });

  it("replaces existing marked section", () => {
    const first = mergePiManagedSection("", "ONE");
    const second = mergePiManagedSection(first, "TWO");
    expect(second.includes("ONE")).toBe(false);
    expect(second.includes("TWO")).toBe(true);
    expect(second.split(PI_CLI_MARK_START).length - 1).toBe(1);
  });
});
