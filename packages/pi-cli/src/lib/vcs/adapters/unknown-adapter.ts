import type { FileHunk, HunkMode, VcsAdapter, VcsCapabilities } from "../types.js";

/** Safe fallback when no VCS is detected — avoids throwing in CLI paths. */
export class UnknownAdapter implements VcsAdapter {
  readonly name = "unknown";
  readonly capabilities: VcsCapabilities = {
    hasStaging: false,
    hasNamedBranches: false,
    supportsDiffVsRef: false,
    supportsUnifiedDiff: false,
  };

  constructor(_cwd: string) {}

  async getCurrentBranch(): Promise<string | undefined> {
    return undefined;
  }

  async getChangedFiles(_ref?: string): Promise<string[]> {
    return [];
  }

  async getPendingChanges(): Promise<string[]> {
    return [];
  }

  async getHunks(_mode: HunkMode): Promise<FileHunk[]> {
    return [];
  }

  async getLastCommitMessage(): Promise<string | undefined> {
    return undefined;
  }
}
