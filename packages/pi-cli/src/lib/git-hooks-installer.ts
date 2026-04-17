import fs from "node:fs/promises";
import path from "node:path";

export type HookManager = "none" | "husky" | "lefthook";

export const PI_HOOK_MARKER_BEGIN = "# --- @pi-api/cli managed (begin) ---";
const PI_MARKER_BEGIN = PI_HOOK_MARKER_BEGIN;
const PI_MARKER_END = "# --- @pi-api/cli managed (end) ---";

const PRE_COMMIT_BODY = `#!/bin/sh
${PI_MARKER_BEGIN}
# Pi: validate staged changes before commit (install via pi-hokage / pi init --with-hooks)
set -e
if command -v pi >/dev/null 2>&1; then
  pi validate --staged --strict --no-auto || {
    echo ""
    echo "Pi validate failed. Fix issues or bypass with: git commit --no-verify"
    echo "Tip: pi fix --staged"
    exit 1
  }
elif command -v npx >/dev/null 2>&1; then
  npx --yes @pi-api/cli validate --staged --strict --no-auto || {
    echo ""
    echo "Pi validate failed. Fix issues or bypass with: git commit --no-verify"
    echo "Tip: pi fix --staged"
    exit 1
  }
else
  echo "Pi: neither 'pi' nor 'npx' found on PATH — skipping pre-commit validate"
fi
${PI_MARKER_END}
`;

const PRE_PUSH_BODY = `#!/bin/sh
${PI_MARKER_BEGIN}
# Pi: full validate before push (install via pi-hokage / pi init --with-hooks)
set -e
if command -v pi >/dev/null 2>&1; then
  pi validate --strict --no-auto || {
    echo ""
    echo "Pi validate failed. Fix issues or bypass with: git push --no-verify"
    exit 1
  }
elif command -v npx >/dev/null 2>&1; then
  npx --yes @pi-api/cli validate --strict --no-auto || {
    echo ""
    echo "Pi validate failed. Fix issues or bypass with: git push --no-verify"
    exit 1
  }
else
  echo "Pi: neither 'pi' nor 'npx' found on PATH — skipping pre-push validate"
fi
${PI_MARKER_END}
`;

/** Husky hook file — works with husky v8+; omits husky.sh if team uses minimal hooks. */
const HUSKY_PRE_COMMIT = `#!/usr/bin/env sh
set -e
${PRE_COMMIT_BODY.replace("#!/bin/sh\n", "").replace("set -e\n", "")}
`;

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Walk up from cwd to find a directory containing `.git` (file or dir). */
export async function findGitRoot(start: string): Promise<string | null> {
  let dir = path.resolve(start);
  for (;;) {
    const gitPath = path.join(dir, ".git");
    if (await pathExists(gitPath)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function readJsonIfExists(p: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pkgMentionsHusky(pkg: Record<string, unknown> | null): boolean {
  if (!pkg) return false;
  const scripts = pkg.scripts as Record<string, string> | undefined;
  const prepare = scripts?.prepare?.toLowerCase() ?? "";
  if (prepare.includes("husky")) return true;
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
    ...(pkg.optionalDependencies as Record<string, string> | undefined),
  };
  return Boolean(deps?.husky);
}

function pkgMentionsLefthook(pkg: Record<string, unknown> | null): boolean {
  if (!pkg) return false;
  const deps = {
    ...(pkg.dependencies as Record<string, unknown> | undefined),
    ...(pkg.devDependencies as Record<string, unknown> | undefined),
  };
  return "lefthook" in deps;
}

export async function detectHookManager(cwd: string): Promise<HookManager> {
  const pkg = await readJsonIfExists(path.join(cwd, "package.json"));
  const huskyDir = path.join(cwd, ".husky");
  if ((await pathExists(huskyDir)) || pkgMentionsHusky(pkg)) return "husky";
  const lefthook =
    (await pathExists(path.join(cwd, "lefthook.yml"))) ||
    (await pathExists(path.join(cwd, "lefthook.yaml"))) ||
    (await pathExists(path.join(cwd, ".lefthook.yml"))) ||
    pkgMentionsLefthook(pkg);
  if (lefthook) return "lefthook";
  return "none";
}

async function chmodPlusX(file: string): Promise<void> {
  try {
    const stat = await fs.stat(file);
    await fs.chmod(file, stat.mode | 0o111);
  } catch {
    /* windows may ignore; non-fatal */
  }
}

async function writeHookIfMissingOrManaged(abs: string, body: string): Promise<"written" | "skipped" | "would_overwrite"> {
  let existing = "";
  try {
    existing = await fs.readFile(abs, "utf8");
  } catch {
    existing = "";
  }
  if (existing.includes(PI_MARKER_BEGIN)) {
    await fs.writeFile(abs, body, "utf8");
    await chmodPlusX(abs);
    return "written";
  }
  if (existing.trim().length > 0) {
    return "would_overwrite";
  }
  await fs.writeFile(abs, body, "utf8");
  await chmodPlusX(abs);
  return "written";
}

/** Lefthook merges `lefthook-local.yml` with the main config — avoids corrupting team YAML. */
const LEFTHOOK_LOCAL_BODY = `${PI_MARKER_BEGIN}
pre-commit:
  commands:
    pi-validate:
      run: pi validate --staged --strict --no-auto
${PI_MARKER_END}
`;

async function installLefthookLocal(cwd: string): Promise<{ ok: boolean; path: string; note?: string }> {
  const localPath = path.join(cwd, "lefthook-local.yml");
  let raw = "";
  try {
    raw = await fs.readFile(localPath, "utf8");
  } catch {
    raw = "";
  }
  const trimmed = raw.trim();
  if (trimmed && !raw.includes(PI_MARKER_BEGIN)) {
    return {
      ok: true,
      path: localPath,
      note:
        "lefthook-local.yml already exists (not Pi-managed). Add under pre-commit.commands:\n  pi-validate:\n    run: pi validate --staged --strict --no-auto",
    };
  }
  await fs.writeFile(localPath, LEFTHOOK_LOCAL_BODY.trim() + "\n", "utf8");
  return {
    ok: true,
    path: localPath,
    note: trimmed
      ? "Updated Pi block in lefthook-local.yml"
      : "Created lefthook-local.yml (lefthook merges with lefthook.yml). Commit if your team uses lefthook.",
  };
}

export type InstallGitHooksResult = {
  manager: HookManager;
  preCommit?: "written" | "skipped" | "would_overwrite";
  prePush?: "written" | "skipped" | "would_overwrite";
  paths: string[];
  warnings: string[];
};

/**
 * Install Pi git hooks: prefer Husky `.husky/` when detected, else Lefthook merge, else `.git/hooks/`.
 */
export async function installGitHooks(cwd: string): Promise<InstallGitHooksResult> {
  const warnings: string[] = [];
  const paths: string[] = [];
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    return { manager: "none", paths, warnings: ["No Git repository found (no .git parent). Skipping hooks."] };
  }

  const manager = await detectHookManager(gitRoot);

  if (manager === "husky") {
    const huskyDir = path.join(gitRoot, ".husky");
    await fs.mkdir(huskyDir, { recursive: true });
    const preCommitPath = path.join(huskyDir, "pre-commit");
    const pre = await writeHookIfMissingOrManaged(preCommitPath, HUSKY_PRE_COMMIT);
    paths.push(preCommitPath);
    if (pre === "would_overwrite") {
      warnings.push(`.husky/pre-commit exists and is not Pi-managed; left unchanged.`);
    }
    const gitHooksDir = path.join(gitRoot, ".git", "hooks");
    const prePushPath = path.join(gitHooksDir, "pre-push");
    const pp = await writeHookIfMissingOrManaged(prePushPath, PRE_PUSH_BODY);
    paths.push(prePushPath);
    if (pp === "would_overwrite") {
      warnings.push(`.git/hooks/pre-push exists and is not Pi-managed; left unchanged.`);
    }
    return { manager: "husky", preCommit: pre, prePush: pp, paths, warnings };
  }

  if (manager === "lefthook") {
    const r = await installLefthookLocal(gitRoot);
    paths.push(r.path);
    if (r.note) warnings.push(r.note);
    const gitHooksDir = path.join(gitRoot, ".git", "hooks");
    const prePushPath = path.join(gitHooksDir, "pre-push");
    const pp = await writeHookIfMissingOrManaged(prePushPath, PRE_PUSH_BODY);
    paths.push(prePushPath);
    if (pp === "would_overwrite") {
      warnings.push(`.git/hooks/pre-push exists and is not Pi-managed; left unchanged.`);
    }
    return { manager: "lefthook", prePush: pp, paths, warnings };
  }

  const hooksDir = path.join(gitRoot, ".git", "hooks");
  await fs.mkdir(hooksDir, { recursive: true });
  const preCommitPath = path.join(hooksDir, "pre-commit");
  const prePushPath = path.join(hooksDir, "pre-push");
  const pre = await writeHookIfMissingOrManaged(preCommitPath, PRE_COMMIT_BODY);
  const pp = await writeHookIfMissingOrManaged(prePushPath, PRE_PUSH_BODY);
  paths.push(preCommitPath, prePushPath);
  if (pre === "would_overwrite") warnings.push(`.git/hooks/pre-commit exists and is not Pi-managed; left unchanged.`);
  if (pp === "would_overwrite") warnings.push(`.git/hooks/pre-push exists and is not Pi-managed; left unchanged.`);
  return { manager: "none", preCommit: pre, prePush: pp, paths, warnings };
}
