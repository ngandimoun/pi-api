import { describe, expect, it } from "vitest";

import { routineSpecToMarkdown, routineSpecificationSchema } from "./index";

describe("composition-oriented routine markdown", () => {
  it("renders references and files manifest", () => {
    const spec = routineSpecificationSchema.parse({
      metadata: {
        id: "glue-feature",
        version: 1,
        intent: "Combine auth and upload",
        tags: ["integration"],
        references: ["auth-setup", "upload-base"],
      },
      context: {
        framework: "Next.js",
        existing_patterns: { imports: [], components: [], hooks: [] },
        constraints: { must_use: [], must_not: [], conventions: [] },
      },
      files_manifest: [
        {
          path: "src/app/api/photos/route.ts",
          purpose: "API route wiring auth + storage",
          depends_on: ["src/lib/auth.ts", "src/lib/storage.ts"],
          action: "create",
        },
      ],
      phases: [
        {
          id: "p1",
          title: "Integration",
          steps: [
            {
              id: "s1",
              action: "verify",
              description: "Smoke test",
              critical_rules: [],
              validation_checks: [],
            },
          ],
        },
      ],
      validation: { required_files: [], required_exports: [], test_commands: [] },
    });
    const md = routineSpecToMarkdown(spec);
    expect(md).toContain("Depends on prior routines");
    expect(md).toContain("auth-setup");
    expect(md).toContain("## Related Routines");
    expect(md).toContain("## Files This Routine Creates or Modifies");
    expect(md).toContain("src/app/api/photos/route.ts");
  });
});
