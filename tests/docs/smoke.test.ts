import fs from "node:fs";
import path from "path";

type DocsManifest = {
  requiredPaths?: string[];
};

describe("docs smoke", () => {
  it("documents expand convention and long-polling", () => {
    const intro = fs.readFileSync(path.resolve(process.cwd(), "docs/v1/intro.mdx"), "utf8");
    const jobs = fs.readFileSync(path.resolve(process.cwd(), "docs/v1/endpoints/jobs.mdx"), "utf8");

    expect(intro).toContain("Expansion Convention (`expand=`)");
    expect(jobs).toContain("wait_for_completion");
    expect(jobs).toContain("When to not use `fields`");
  });

  it("lists required docs from docs-manifest.json and each file exists with content", () => {
    const manifestPath = path.resolve(process.cwd(), "docs/docs-manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const raw = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as DocsManifest;
    expect(Array.isArray(manifest.requiredPaths)).toBe(true);
    for (const rel of manifest.requiredPaths ?? []) {
      const abs = path.resolve(process.cwd(), rel);
      expect(fs.existsSync(abs), `missing ${rel}`).toBe(true);
      const content = fs.readFileSync(abs, "utf8");
      expect(content.trim().length).toBeGreaterThan(0);
    }
  });

  it("intro links to hub and quickstart", () => {
    const intro = fs.readFileSync(path.resolve(process.cwd(), "docs/v1/intro.mdx"), "utf8");
    expect(intro).toContain("[API reference index (all endpoints)](../README.md)");
    expect(intro).toContain("./quickstart");
    expect(intro).toContain("## Local development");
    expect(intro).toContain("PROJECTION_GOLDEN_MAX_DETERMINISTIC_RATE");
  });

  it("quickstart documents fetch and external integration", () => {
    const qs = fs.readFileSync(path.resolve(process.cwd(), "docs/v1/quickstart.mdx"), "utf8");
    expect(qs).toContain("async function piRequest");
    expect(qs).toContain("Authorization: Bearer");
    expect(qs).toContain("in-repo");
  });

  it("brand projection documents deterministic meta", () => {
    const bp = fs.readFileSync(
      path.resolve(process.cwd(), "docs/v1/endpoints/brand-project.mdx"),
      "utf8"
    );
    expect(bp).toContain("deterministic_projection");
    expect(bp).toContain("\"status\": \"completed\"");
  });

  it("artifacts index documents canonical E2E snapshot", () => {
    const ar = fs.readFileSync(path.resolve(process.cwd(), "artifacts/README.md"), "utf8");
    expect(ar).toContain("brand-e2e-green-run.json");
    expect(ar).toContain("Canonical brand");
  });

  it(".cursorrules mandates artifacts README for fixture reuse", () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), ".cursorrules"), "utf8");
    expect(rules).toContain("artifacts/README.md");
    expect(rules).toContain("brand-e2e-green-run.json");
  });
});
