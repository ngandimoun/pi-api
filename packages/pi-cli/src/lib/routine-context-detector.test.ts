import { describe, expect, it } from "vitest";

import { changedFileMatchesManifest, scoreRoutineIndexEntryForRepo } from "./routine-context-detector.js";
import type { RoutineIndexEntry } from "./routine-index.js";

function entry(partial: Partial<RoutineIndexEntry> & Pick<RoutineIndexEntry, "id" | "file_path">): RoutineIndexEntry {
  return {
    version: 1,
    intent: "",
    tags: [],
    files_manifest: [],
    references: [],
    created_at: "",
    ...partial,
  };
}

describe("changedFileMatchesManifest", () => {
  it("matches exact path", () => {
    expect(changedFileMatchesManifest("src/app/page.tsx", ["src/app/page.tsx"])).toBe(true);
  });

  it("matches prefix glob", () => {
    expect(changedFileMatchesManifest("src/mastra/foo.ts", ["src/mastra/**"])).toBe(true);
  });
});

describe("scoreRoutineIndexEntryForRepo", () => {
  it("adds score for manifest overlap", () => {
    const e = entry({
      id: "demo",
      file_path: ".pi/routines/demo.v1.md",
      intent: "mastra agents",
      tags: ["mastra"],
      files_manifest: ["src/mastra/agents/foo.ts"],
    });
    const s = scoreRoutineIndexEntryForRepo(e, "any", ["src/mastra/agents/foo.ts"]);
    expect(s).toBeGreaterThanOrEqual(3);
  });

  it("adds score for branch token overlap", () => {
    const e = entry({
      id: "feature-auth",
      file_path: ".pi/routines/feature-auth.v1.md",
      intent: "authentication setup",
      tags: ["auth"],
      files_manifest: [],
    });
    const s = scoreRoutineIndexEntryForRepo(e, "auth-refactor", []);
    expect(s).toBeGreaterThanOrEqual(2);
  });
});
