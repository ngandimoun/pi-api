import { describe, expect, it } from "vitest";

import {
  isEnhancedRoutineMarkdown,
  parseRoutineMarkdownFull,
  routineSpecToMarkdown,
  splitFrontmatter,
} from "./index";
import { routineSpecificationSchema } from "./schema";

describe("routineSpecToMarkdown + parse", () => {
  it("round-trips frontmatter detection", () => {
    const spec = routineSpecificationSchema.parse({
      metadata: {
        id: "test-routine",
        version: 1,
        intent: "do something",
        tags: ["a"],
        references: [],
      },
      context: {
        framework: "Next.js",
        existing_patterns: { imports: ["@/lib/x"], components: [], hooks: [] },
        constraints: { must_use: ["Use existing client"], must_not: [], conventions: [] },
      },
      files_manifest: [
        {
          path: "src/lib/x.ts",
          purpose: "Shared client",
          depends_on: [],
          action: "verify",
        },
      ],
      phases: [
        {
          id: "p1",
          title: "Phase 1",
          steps: [
            {
              id: "s1",
              action: "verify",
              description: "Check setup",
              critical_rules: [],
              validation_checks: ["ok"],
            },
          ],
        },
      ],
      validation: { required_files: [], required_exports: [], test_commands: ["npm test"] },
    });
    const md = routineSpecToMarkdown(spec);
    expect(isEnhancedRoutineMarkdown(md)).toBe(true);
    const split = splitFrontmatter(md);
    expect(split?.frontmatter.id).toBe("test-routine");

    const full = parseRoutineMarkdownFull(md);
    expect(full).not.toBeNull();
    expect(full?.metadata.id).toBe("test-routine");
    expect(full?.phases.length).toBeGreaterThan(0);
    expect(full?.files_manifest.length).toBeGreaterThan(0);
  });
});
