export type FileHunk = {
  file: string;
  hunks: { startLine: number; endLine: number; content: string }[];
};

export interface VcsCapabilities {
  hasStaging: boolean;
  hasNamedBranches: boolean;
  supportsDiffVsRef: boolean;
  supportsUnifiedDiff: boolean;
}

/** `committed` = vs last revision; `pending` = working / shelved / staged changes */
export type HunkMode = "committed" | "pending";

export interface VcsAdapter {
  readonly name: string;
  readonly capabilities: VcsCapabilities;

  getCurrentBranch(): Promise<string | undefined>;
  /** Paths changed vs ref (Git: `git diff --name-only <ref>`) */
  getChangedFiles(ref?: string): Promise<string[]>;
  /** Uncommitted / pending paths */
  getPendingChanges(): Promise<string[]>;
  getHunks(mode: HunkMode): Promise<FileHunk[]>;
  getLastCommitMessage(): Promise<string | undefined>;

  getStagedFiles?(): Promise<string[]>;
  getUnstagedFiles?(): Promise<string[]>;
}

export type VcsType = "git" | "gitlab" | "bitbucket" | "gerrit" | "perforce" | "unknown";
