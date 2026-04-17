import simpleGit from "simple-git";

import { getChangedFilesSince, getChangedFilesWorkingTree } from "../../git/diff.js";
import { getChangedHunks } from "../../git/hunk.js";
import type { FileHunk, HunkMode, VcsAdapter, VcsCapabilities, VcsType } from "../types.js";

export class GitAdapter implements VcsAdapter {
  readonly name: VcsType = "git";
  readonly capabilities: VcsCapabilities = {
    hasStaging: true,
    hasNamedBranches: true,
    supportsDiffVsRef: true,
    supportsUnifiedDiff: true,
  };

  constructor(private readonly cwd: string) {}

  async getCurrentBranch(): Promise<string | undefined> {
    try {
      const git = simpleGit({ baseDir: this.cwd });
      const b = await git.revparse(["--abbrev-ref", "HEAD"]);
      const name = b.trim();
      return name || undefined;
    } catch {
      return undefined;
    }
  }

  async getChangedFiles(ref = "HEAD"): Promise<string[]> {
    return getChangedFilesSince(this.cwd, ref);
  }

  async getPendingChanges(): Promise<string[]> {
    return getChangedFilesWorkingTree(this.cwd);
  }

  async getHunks(mode: HunkMode): Promise<FileHunk[]> {
    const m = mode === "committed" ? "head" : "staged";
    return getChangedHunks(this.cwd, m);
  }

  async getLastCommitMessage(): Promise<string | undefined> {
    try {
      const git = simpleGit({ baseDir: this.cwd });
      const log = await git.log({ maxCount: 1 });
      return log.latest?.message?.split("\n")[0]?.trim();
    } catch {
      return undefined;
    }
  }

  async getStagedFiles(): Promise<string[]> {
    try {
      const git = simpleGit({ baseDir: this.cwd });
      const d = await git.diff(["--name-only", "--staged"]);
      return d.split("\n").map((l) => l.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  async getUnstagedFiles(): Promise<string[]> {
    try {
      const git = simpleGit({ baseDir: this.cwd });
      const d = await git.diff(["--name-only"]);
      return d.split("\n").map((l) => l.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}
