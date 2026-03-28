import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SKILLS_REPO = "mastra-ai/skills";
const AGENT = "cursor";
const EXPECTED_SKILL_DIR = "mastra";

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }
}

function main() {
  const repoRoot = process.cwd();
  const skillsRoot = path.resolve(repoRoot, ".agents", "skills");

  const expectedDir = path.resolve(skillsRoot, EXPECTED_SKILL_DIR);
  if (fs.existsSync(expectedDir)) {
    fs.rmSync(expectedDir, { recursive: true, force: true });
  }

  run("npx", ["skills", "add", SKILLS_REPO, "--agent", AGENT, "-y", "--copy"]);

  const expectedSkillMd = path.resolve(expectedDir, "SKILL.md");
  if (!fs.existsSync(expectedSkillMd)) {
    throw new Error(
      `mastra:skills:update failed: expected ${path.relative(repoRoot, expectedSkillMd)} to exist after install`
    );
  }

  console.info("mastra:skills:update ok", {
    repo: SKILLS_REPO,
    skill: EXPECTED_SKILL_DIR,
    path: path.relative(repoRoot, expectedDir),
  });
}

try {
  main();
} catch (error) {
  console.error("mastra:skills:update failed:", error?.message ?? String(error));
  process.exit(1);
}

