import { PI_ROUTINES_DIR } from "./constants.js";
import { getCurrentBranch, getPendingChanges } from "./vcs/index.js";
import { getRoutineIndex, type RoutineIndexEntry } from "./routine-index.js";

const MAX_INJECT_ROUTINES = 8;

/** Optional routine id lists from API / workflow payloads (all merged, de-duplicated). */
export function parseRoutineIdsFromApiPayload(obj: Record<string, unknown> | undefined): string[] {
  if (!obj) return [];
  const keys = ["inject_routine_ids", "related_routine_slugs", "routine_dependencies"] as const;
  const out: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) out.push(...(v as string[]));
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

/**
 * Build repo-relative routine paths for IDE injection: primary file + referenced routines
 * (from routine index) + optional ids returned by the API. Capped to avoid token waste.
 */
export function mergePrimaryAndReferenceRoutinePaths(
  slug: string,
  version: number,
  entries: RoutineIndexEntry[],
  apiExtraRoutineIds?: string[]
): string[] {
  const primary = `${PI_ROUTINES_DIR}/${slug}.v${version}.md`.replace(/\\/g, "/");
  const out: string[] = [primary];
  const seenId = new Set<string>([slug]);
  const primaryEntry = entries.find(
    (e) => e.id === slug || e.file_path.replace(/\\/g, "/").endsWith(`/${slug}.v${version}.md`)
  );
  const refs = [
    ...(primaryEntry?.references ?? []),
    ...(apiExtraRoutineIds ?? []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  for (const id of refs) {
    if (out.length >= MAX_INJECT_ROUTINES) break;
    if (seenId.has(id)) continue;
    seenId.add(id);
    const hit = entries.find((e) => e.id === id);
    if (hit) {
      const fp = hit.file_path.replace(/\\/g, "/");
      if (!out.includes(fp)) out.push(fp);
    }
  }
  return out;
}

const MAX_AUTO_ROUTINES = 5;

function tokenizeBranch(branch: string): string[] {
  return branch
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

/** Rough glob support for manifest paths (`**` segments stripped to prefix match). */
export function changedFileMatchesManifest(relPosix: string, manifest: string[]): boolean {
  const norm = relPosix.replace(/\\/g, "/");
  for (const raw of manifest) {
    const p = raw.replace(/\\/g, "/").trim();
    if (!p) continue;
    if (p.includes("**")) {
      const prefix = p.split("**")[0]?.replace(/\/$/, "") ?? "";
      if (prefix && (norm === prefix || norm.startsWith(`${prefix}/`))) return true;
    } else if (norm === p || norm.startsWith(`${p}/`)) {
      return true;
    }
  }
  return false;
}

export function scoreRoutineIndexEntryForRepo(
  entry: RoutineIndexEntry,
  branchName: string,
  changedRelPaths: string[] | undefined
): number {
  return scoreEntry(entry, tokenizeBranch(branchName), changedRelPaths);
}

function scoreEntry(entry: RoutineIndexEntry, branchTokens: string[], changedRel: string[] | undefined): number {
  let score = 0;
  const hay = `${entry.id} ${entry.intent} ${entry.tags.join(" ")}`.toLowerCase();
  for (const t of branchTokens) {
    if (hay.includes(t)) score += 2;
  }
  if (changedRel?.length && entry.files_manifest.length) {
    for (const rel of changedRel) {
      if (changedFileMatchesManifest(rel, entry.files_manifest)) score += 3;
    }
  }
  return score;
}

/**
 * Picks a small set of routine index entries relevant to the current branch and/or changed files.
 * Caps results to avoid loading unrelated routines into IDE context.
 * E4: When PI_CLI_ROUTINE_REPO_CONTEXT is on, also scores by intent-token overlap.
 */
export async function detectRelevantRoutineRelPaths(
  cwd: string,
  opts: { branchName?: string; changedRelPaths?: string[]; intent?: string }
): Promise<string[]> {
  const entries = await getRoutineIndex(cwd);
  if (!entries.length) return [];

  const branchTokens = tokenizeBranch(opts.branchName ?? "");
  const changed = opts.changedRelPaths?.map((p) => p.replace(/\\/g, "/"));

  // E4: Tokenize intent for cross-routine matching when REPO_CONTEXT is enabled
  const intentTokens = opts.intent && process.env.PI_CLI_ROUTINE_REPO_CONTEXT
    ? opts.intent
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((t) => t.length > 2)
    : [];

  const scored = entries
    .map((e) => {
      let s = scoreEntry(e, branchTokens, changed);
      
      // E4: Bonus for intent-token overlap
      if (intentTokens.length > 0) {
        const routineHay = `${e.intent} ${e.tags.join(" ")}`.toLowerCase();
        for (const token of intentTokens) {
          if (routineHay.includes(token)) s += 1;
        }
      }
      
      return { e, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.file_path.localeCompare(b.e.file_path));

  const out: string[] = [];
  for (const { e } of scored.slice(0, MAX_AUTO_ROUTINES)) {
    if (!out.includes(e.file_path)) out.push(e.file_path);
  }
  return out;
}

/**
 * Returns routine **ids** (not file paths) scored by branch name + changed files vs index manifests.
 */
export async function suggestRoutineIdsFromRepoContext(
  cwd: string,
  opts: { branchName?: string; changedRelPaths?: string[] }
): Promise<string[]> {
  const entries = await getRoutineIndex(cwd);
  if (!entries.length) return [];

  const branchTokens = tokenizeBranch(opts.branchName ?? "");
  const changed = opts.changedRelPaths?.map((p) => p.replace(/\\/g, "/"));

  const scored = entries
    .map((e) => ({ e, s: scoreEntry(e, branchTokens, changed) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.file_path.localeCompare(b.e.file_path));

  const out: string[] = [];
  for (const { e } of scored.slice(0, MAX_AUTO_ROUTINES)) {
    if (!out.includes(e.id)) out.push(e.id);
  }
  return out;
}

/** Scored routine ids from current branch name + pending file paths (for doctor / diagnostics). */
export async function getRepoContextRoutineRankings(
  cwd: string
): Promise<{ id: string; score: number }[]> {
  const entries = await getRoutineIndex(cwd);
  if (!entries.length) return [];

  const branch = (await getCurrentBranch(cwd)) ?? "";
  const changed = await getPendingChanges(cwd);
  const branchTokens = tokenizeBranch(branch);
  const changedNorm = changed.map((p) => p.replace(/\\/g, "/"));

  return entries
    .map((e) => ({ id: e.id, score: scoreEntry(e, branchTokens, changedNorm) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 8);
}
