import path from "node:path";

import { createVcsAdapter } from "./detector.js";
import type { FileHunk, HunkMode, VcsAdapter } from "./types.js";

const adapters = new Map<string, VcsAdapter>();

function key(cwd: string): string {
  return path.resolve(cwd);
}

/** Clear cached adapter (e.g. after VCS config change). */
export function clearVcsAdapterCache(cwd?: string): void {
  if (cwd === undefined) adapters.clear();
  else adapters.delete(key(cwd));
}

export async function getVcs(cwd: string): Promise<VcsAdapter> {
  const k = key(cwd);
  let a = adapters.get(k);
  if (!a) {
    a = await createVcsAdapter(cwd);
    adapters.set(k, a);
  }
  return a;
}

export async function getCurrentBranch(cwd: string): Promise<string | undefined> {
  return (await getVcs(cwd)).getCurrentBranch();
}

/** @param ref VCS-specific ref (Git: `HEAD`, branch, etc.) */
export async function getChangedFiles(cwd: string, ref?: string): Promise<string[]> {
  return (await getVcs(cwd)).getChangedFiles(ref);
}

export async function getPendingChanges(cwd: string): Promise<string[]> {
  return (await getVcs(cwd)).getPendingChanges();
}

export async function getChangedHunksVcs(cwd: string, mode: HunkMode): Promise<FileHunk[]> {
  return (await getVcs(cwd)).getHunks(mode);
}

/** Maps to Git `head` vs `staged` behavior for backwards compatibility */
export async function getChangedHunksLegacy(cwd: string, mode: "head" | "staged"): Promise<FileHunk[]> {
  const vcs = await getVcs(cwd);
  const m = mode === "head" ? "committed" : "pending";
  return vcs.getHunks(m);
}

export async function getLastCommitMessage(cwd: string): Promise<string | undefined> {
  return (await getVcs(cwd)).getLastCommitMessage();
}

export { detectVcsType, createAdapterForType } from "./detector.js";
export type { FileHunk, HunkMode, VcsAdapter, VcsCapabilities, VcsType } from "./types.js";
