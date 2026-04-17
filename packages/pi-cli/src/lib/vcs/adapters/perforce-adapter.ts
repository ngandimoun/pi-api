import { execa } from "execa";

import { parseUnifiedDiff } from "../../git/hunk.js";
import type { FileHunk, HunkMode, VcsAdapter, VcsCapabilities } from "../types.js";

async function p4(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const r = await execa("p4", args, {
    cwd,
    reject: false,
    env: { ...process.env },
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.exitCode ?? 1 };
}

/**
 * Best-effort Helix Core (Perforce) adapter via `p4` CLI.
 * Requires a configured client/workspace for `cwd`.
 */
export class PerforceAdapter implements VcsAdapter {
  readonly name = "perforce";
  readonly capabilities: VcsCapabilities = {
    hasStaging: false,
    hasNamedBranches: false,
    supportsDiffVsRef: true,
    supportsUnifiedDiff: true,
  };

  constructor(private readonly cwd: string) {}

  async getCurrentBranch(): Promise<string | undefined> {
    const r = await p4(this.cwd, ["info"]);
    if (r.exitCode !== 0) return undefined;
    const client = /^Client name:\s*(.+)$/m.exec(r.stdout);
    const stream = /^Client stream:\s*(.+)$/m.exec(r.stdout);
    return (stream?.[1] ?? client?.[1])?.trim();
  }

  async getChangedFiles(_ref?: string): Promise<string[]> {
    const plain = await p4(this.cwd, ["opened"]);
    if (plain.exitCode !== 0) return [];
    return parseOpenedPaths(plain.stdout);
  }

  async getPendingChanges(): Promise<string[]> {
    return this.getChangedFiles();
  }

  async getHunks(mode: HunkMode): Promise<FileHunk[]> {
    if (mode === "committed") {
      // Last submitted change — best effort: `p4 changes -m1`
      const ch = await p4(this.cwd, ["changes", "-m1", "-s", "submitted"]);
      if (ch.exitCode !== 0) return [];
      const num = /^Change\s+(\d+)/m.exec(ch.stdout)?.[1];
      if (!num) return [];
      const d = await p4(this.cwd, ["describe", "-du", num]);
      if (d.exitCode !== 0) return [];
      return parseUnifiedDiff(extractDiffFromDescribe(d.stdout));
    }
    const diff = await p4(this.cwd, ["diff", "-du"]);
    if (diff.exitCode !== 0) return [];
    return parseUnifiedDiff(normalizeP4UnifiedDiff(diff.stdout));
  }

  async getLastCommitMessage(): Promise<string | undefined> {
    const ch = await p4(this.cwd, ["changes", "-m1", "-s", "submitted", "-l"]);
    if (ch.exitCode !== 0) return undefined;
    const desc = /^Change \d+ on .+\n\n([\s\S]+)/m.exec(ch.stdout);
    return desc?.[1]?.split("\n")[0]?.trim();
  }
}

function parseOpenedPaths(stdout: string): string[] {
  const out: string[] = [];
  for (const line of stdout.split("\n")) {
    const m = /^(\/\/[^\s#]+)/.exec(line.trim());
    if (m?.[1]) out.push(m[1]);
  }
  return [...new Set(out)];
}

/** p4 describe contains diffs; extract unified blocks */
function extractFromDescribe(stdout: string): string {
  const idx = stdout.indexOf("====");
  if (idx >= 0) return stdout.slice(idx);
  return stdout;
}

function extractDiffFromDescribe(stdout: string): string {
  return normalizeP4UnifiedDiff(extractFromDescribe(stdout));
}

/** Ensure +++ b/ lines for shared parser */
function normalizeP4UnifiedDiff(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith("--- ") && !line.startsWith("--- /")) {
      out.push(line);
      continue;
    }
    if (line.startsWith("+++ ") && !line.startsWith("+++ b/") && !line.startsWith("+++ /")) {
      const path = line.slice(4).trim();
      out.push(`+++ b/${path.replace(/^\/\//, "")}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}
