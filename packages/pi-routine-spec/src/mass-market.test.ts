import { describe, expect, it } from "vitest";

import { detectRoutineDrift } from "./drift.js";
import { executionPlanSchema, renderExecutionPlan } from "./execution-plan.js";
import { routineSpecificationSchema } from "./schema.js";

describe("routine drift", () => {
  it("flags missing create manifest paths", () => {
    const spec = routineSpecificationSchema.parse({
      metadata: {
        id: "a",
        version: 1,
        intent: "t",
        tags: [],
        references: [],
      },
      context: {
        framework: "",
        existing_patterns: { imports: [], components: [], hooks: [] },
        constraints: { must_use: [], must_not: [], conventions: [] },
      },
      files_manifest: [{ path: "src/app/x.ts", purpose: "p", depends_on: [], action: "create" }],
      phases: [
        {
          id: "p1",
          title: "t",
          steps: [{ id: "s1", action: "verify", description: "d", critical_rules: [], validation_checks: [] }],
        },
      ],
      validation: { required_files: [], required_exports: [], test_commands: [] },
    });
    const v = detectRoutineDrift(["src/other.ts"], spec);
    expect(v.some((x) => x.type === "missing_file")).toBe(true);
    expect(v.some((x) => x.type === "unexpected_file")).toBe(true);
  });
});

describe("execution plan", () => {
  it("renders markdown with pi_execution_plan frontmatter", () => {
    const plan = executionPlanSchema.parse({
      plan_id: "p1",
      intent: "do things",
      routines: [
        {
          routine_id: "a",
          routine_file: ".pi/routines/a.v1.md",
          execution_order: 1,
          reason: "auth",
        },
      ],
    });
    const md = renderExecutionPlan(plan);
    expect(md).toContain("pi_execution_plan");
    expect(md).toContain("pi_execution_plan: \"1\"");
    expect(md).toContain("a");
  });
});
