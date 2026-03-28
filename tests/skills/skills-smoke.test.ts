import fs from "node:fs";
import path from "node:path";

function read(relPath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

describe("skills smoke", () => {
  it("has vendored Mastra + Gemini skills installed", () => {
    const mastraSkill = read(".agents/skills/mastra/SKILL.md");
    const geminiSkill = read(".agents/skills/gemini-interactions-api/SKILL.md");

    expect(mastraSkill).toContain("# Mastra Framework Guide");
    expect(geminiSkill).toContain("# Gemini Interactions API Skill");
    expect(geminiSkill).toContain("Never generate code that references a deprecated model ID.");
  });

  it("has Cursor rules for Mastra and Gemini skills", () => {
    const mastraRule = read(".cursor/rules/mastra.mdc");
    const geminiRule = read(".cursor/rules/gemini-skills.mdc");

    expect(mastraRule).toContain(".agents/skills/mastra/SKILL.md");
    expect(geminiRule).toContain(".agents/skills/gemini-interactions-api/SKILL.md");
  });
});

