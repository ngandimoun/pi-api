import fs from "node:fs/promises";
import path from "node:path";

import simpleGit from "simple-git";
import { execa } from "execa";

import { readPiProjectConfig, resolveVcsTypeFromConfig } from "../pi-project-config.js";
import { BitbucketAdapter, GerritAdapter, GitLabAdapter } from "./adapters/host-git-adapters.js";
import { GitAdapter } from "./adapters/git-adapter.js";
import { PerforceAdapter } from "./adapters/perforce-adapter.js";
import { UnknownAdapter } from "./adapters/unknown-adapter.js";
import type { VcsAdapter } from "./types.js";
import type { VcsType } from "./types.js";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function getOriginUrl(cwd: string): Promise<string | undefined> {
  try {
    const git = simpleGit({ baseDir: cwd });
    const r = await git.getRemotes(true);
    const origin = r.find((x) => x.name === "origin");
    return origin?.refs?.fetch ?? origin?.refs?.push;
  } catch {
    return undefined;
  }
}

function classifyGitHost(url: string): Exclude<VcsType, "perforce" | "unknown"> {
  const u = url.toLowerCase();
  if (u.includes("gitlab")) return "gitlab";
  if (u.includes("bitbucket")) return "bitbucket";
  if (u.includes("gerrit") || u.includes("review.")) return "gerrit";
  return "git";
}

export async function detectVcsType(cwd: string): Promise<VcsType> {
  const gitDir = path.join(cwd, ".git");
  if (await pathExists(gitDir)) {
    const url = await getOriginUrl(cwd);
    if (url) return classifyGitHost(url);
    return "git";
  }

  const p4Markers = [path.join(cwd, "P4CONFIG"), path.join(cwd, ".p4config")];
  for (const p of p4Markers) {
    if (await pathExists(p)) return "perforce";
  }

  try {
    const r = await execa("p4", ["info"], { cwd, reject: false, timeout: 3000 });
    if (r.exitCode === 0 && /Client name:/i.test(r.stdout)) return "perforce";
  } catch {
    // p4 not installed
  }

  return "unknown";
}

export async function createVcsAdapter(cwd: string): Promise<VcsAdapter> {
  const cfg = await readPiProjectConfig(cwd);
  const fromCfg = resolveVcsTypeFromConfig(cfg);
  if (fromCfg !== "auto") {
    return createAdapterForType(cwd, fromCfg);
  }
  const detected = await detectVcsType(cwd);
  return createAdapterForType(cwd, detected);
}

export function createAdapterForType(cwd: string, type: VcsType): VcsAdapter {
  switch (type) {
    case "git":
      return new GitAdapter(cwd);
    case "gitlab":
      return new GitLabAdapter(cwd);
    case "bitbucket":
      return new BitbucketAdapter(cwd);
    case "gerrit":
      return new GerritAdapter(cwd);
    case "perforce":
      return new PerforceAdapter(cwd);
    case "unknown":
    default:
      return new UnknownAdapter(cwd);
  }
}
