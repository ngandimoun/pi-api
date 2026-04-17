import simpleGit from "simple-git";

import type { FileHunk } from "../vcs/types.js";

export type { FileHunk };

/**
 * Parse unified diff text into per-file hunks (git / p4 / etc.).
 */
export function parseUnifiedDiff(diff: string): FileHunk[] {
  const byFile = new Map<string, FileHunk["hunks"]>();
  let currentFile = "";
  let collecting: string[] = [];
  let inHunk = false;

  const flushHunk = () => {
    if (!currentFile || !collecting.length) {
      collecting = [];
      inHunk = false;
      return;
    }
    const header = collecting[0];
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(header);
    if (m) {
      const start = Number.parseInt(m[1], 10);
      const count = m[2] ? Number.parseInt(m[2], 10) : 1;
      const end = count === 0 ? start : start + Math.max(count - 1, 0);
      const arr = byFile.get(currentFile) ?? [];
      arr.push({ startLine: start, endLine: end, content: collecting.join("\n") });
      byFile.set(currentFile, arr);
    }
    collecting = [];
    inHunk = false;
  };

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      flushHunk();
      currentFile = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("@@")) {
      flushHunk();
      inHunk = true;
      collecting = [line];
      continue;
    }
    if (inHunk) {
      collecting.push(line);
    }
  }
  flushHunk();

  return [...byFile.entries()].map(([file, hunks]) => ({ file, hunks }));
}

/**
 * Parse unified diff hunks (git diff --unified=0) for line ranges in the "new" file.
 * `staged` = staged + unstaged changes vs index/HEAD.
 */
export async function getChangedHunks(cwd: string, mode: "head" | "staged" = "head"): Promise<FileHunk[]> {
  const git = simpleGit({ baseDir: cwd });
  let diff: string;
  try {
    if (mode === "head") {
      diff = await git.diff([`--unified=0`, "HEAD"]);
    } else {
      const staged = await git.diff([`--unified=0`, "--staged"]);
      const unstaged = await git.diff([`--unified=0`]);
      diff = `${staged}\n${unstaged}`;
    }
  } catch {
    return [];
  }

  return parseUnifiedDiff(diff);
}
