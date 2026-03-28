import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SKILLS_REPO = "google-gemini/gemini-skills";
const SKILL_NAME = "gemini-interactions-api";
const AGENT = "cursor";

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
  const skillDir = path.resolve(repoRoot, ".agents", "skills", SKILL_NAME);

  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }

  run("npx", [
    "skills",
    "add",
    SKILLS_REPO,
    "--skill",
    SKILL_NAME,
    "--agent",
    AGENT,
    "-y",
    "--copy",
  ]);

  const skillMd = path.resolve(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    throw new Error(
      `skills:update failed: expected ${path.relative(repoRoot, skillMd)} to exist after install`
    );
  }

  console.info("skills:update ok", {
    skill: SKILL_NAME,
    path: path.relative(repoRoot, skillDir),
  });
}

try {
  main();
} catch (error) {
  console.error("skills:update failed:", error?.message ?? String(error));
  process.exit(1);
}

