import { describe, expect, it } from "vitest";

import { expandExtraRoutineIdsForInjection, HUB_INJECTION_EXPANSION } from "./routine-injection-expansion.js";

describe("expandExtraRoutineIdsForInjection", () => {
  it("inserts explicit VT leaves after the VT playbook", () => {
    const out = expandExtraRoutineIdsForInjection(["react-view-transitions-playbook", "ui-ux-playbook"]);
    expect(out[0]).toBe("react-view-transitions-playbook");
    expect(out.slice(1, 3)).toEqual([
      "react-view-transitions-css-recipes",
      "react-view-transitions-implementation-workflow",
    ]);
    expect(out).toContain("ui-ux-playbook");
  });

  it("dedupes globally", () => {
    const out = expandExtraRoutineIdsForInjection([
      "react-view-transitions-playbook",
      "react-view-transitions-css-recipes",
    ]);
    expect(out.filter((x) => x === "react-view-transitions-css-recipes").length).toBe(1);
  });

  it("expands shadcn hub with maxReferences slice from embedded template", () => {
    expect(HUB_INJECTION_EXPANSION["shadcn-ui-playbook"]).toEqual({ maxReferences: 3 });
    const out = expandExtraRoutineIdsForInjection(["shadcn-ui-playbook"]);
    expect(out[0]).toBe("shadcn-ui-playbook");
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.slice(1, 4).every((id) => id.startsWith("shadcn-ui-"))).toBe(true);
  });
});
