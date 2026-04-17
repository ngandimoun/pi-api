import { describe, expect, it } from "vitest";

import { EMBEDDED_ROUTINE_TEMPLATES } from "./embedded-templates.js";
import {
  applyTemplateDominanceRules,
  hasStrongPerformanceIntent,
  hasStrongViewTransitionIntent,
  scoreEmbeddedTemplates,
} from "./routine-template-suggest.js";

describe("scoreEmbeddedTemplates", () => {
  it("ranks react-view-transitions playbook for phrase + tokens", () => {
    const intent = "Add view transitions to our Next.js app with ViewTransition";
    const ids = scoreEmbeddedTemplates(intent, EMBEDDED_ROUTINE_TEMPLATES, 8);
    expect(ids).toContain("react-view-transitions-playbook");
  });

  it("returns empty for too-short tokens only", () => {
    const ids = scoreEmbeddedTemplates("a b", EMBEDDED_ROUTINE_TEMPLATES, 3);
    expect(ids).toEqual([]);
  });
});

describe("applyTemplateDominanceRules", () => {
  it("removes perf playbook when VT is strong and perf is not", () => {
    const ids = new Set(["react-view-transitions-playbook", "react-best-practices-playbook"]);
    applyTemplateDominanceRules(ids, "Implement view transitions with Suspense fallback");
    expect(ids.has("react-view-transitions-playbook")).toBe(true);
    expect(ids.has("react-best-practices-playbook")).toBe(false);
  });

  it("keeps perf playbook when narrow perf signals present", () => {
    const ids = new Set(["react-view-transitions-playbook", "react-best-practices-playbook"]);
    applyTemplateDominanceRules(
      ids,
      "View transitions plus fixing LCP — waterfall in data fetching"
    );
    expect(ids.has("react-best-practices-playbook")).toBe(true);
  });

  it("does not remove perf when VT hub not in set", () => {
    const ids = new Set(["react-best-practices-playbook"]);
    applyTemplateDominanceRules(ids, "view transitions docs");
    expect(ids.has("react-best-practices-playbook")).toBe(true);
  });
});

describe("intent helpers", () => {
  it("detects strong VT", () => {
    expect(hasStrongViewTransitionIntent("use addTransitionType with nav-forward")).toBe(true);
  });
  it("detects strong perf", () => {
    expect(hasStrongPerformanceIntent("fix LCP and bundle size")).toBe(true);
  });
});
