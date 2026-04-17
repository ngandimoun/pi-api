import { describe, expect, it } from "vitest";
import { detectRoutineDrift, routineSpecToMarkdown } from "pi-routine-spec";

import { getEmbeddedTemplateById } from "./lib/embedded-templates.js";
import { buildRoutineSpecForDriftFromMarkdown } from "./lib/routine-index.js";

describe("mass-market integration (offline)", () => {
  it("imports embedded template → markdown → drift spec", () => {
    const t = getEmbeddedTemplateById("next-supabase-auth");
    expect(t).toBeDefined();
    const md = routineSpecToMarkdown(t!.routine_spec);
    const spec = buildRoutineSpecForDriftFromMarkdown(md, t!.routine_spec.metadata.id);
    expect(spec.files_manifest.length).toBeGreaterThan(0);
    const manifestPaths = spec.files_manifest.map((f) => f.path);
    const drift = detectRoutineDrift(manifestPaths, spec);
    expect(drift.length).toBe(0);
  });
});
