import fs from "node:fs/promises";
import path from "node:path";
import {
  isEnhancedRoutineMarkdown,
  parseRoutineMarkdownLoose,
  splitFrontmatter,
} from "pi-routine-spec";

import { PI_ROUTINES_DIR } from "./constants.js";

export type RoutineListItem = {
  filename: string;
  id: string;
  version: number;
  tags: string[];
  enhanced: boolean;
};

function parseFilenameMeta(name: string): { slug: string; version: number } | null {
  const m = name.match(/^(.+)\.v(\d+)\.md$/);
  if (!m) return null;
  return { slug: m[1], version: Number.parseInt(m[2], 10) || 1 };
}

/**
 * List routines under `.pi/routines/` with optional tag filter (tags from YAML when v2).
 */
export async function listRoutines(
  cwd: string,
  opts?: { tags?: string[] }
): Promise<RoutineListItem[]> {
  const dir = path.join(cwd, PI_ROUTINES_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const tagSet = opts?.tags?.length
    ? new Set(opts.tags.map((t) => t.toLowerCase().trim()))
    : null;

  const out: RoutineListItem[] = [];
  for (const f of entries) {
    if (!f.endsWith(".md")) continue;
    const full = path.join(dir, f);
    let enhanced = false;
    let tags: string[] = [];
    let id = f.replace(/\.md$/, "");
    try {
      const raw = await fs.readFile(full, "utf8");
      enhanced = isEnhancedRoutineMarkdown(raw);
      const loose = parseRoutineMarkdownLoose(raw);
      if (loose?.meta.id) id = loose.meta.id;
      if (loose?.meta.tags?.length) tags = loose.meta.tags;
    } catch {
      /* skip */
    }
    const meta = parseFilenameMeta(f);
    if (meta) id = meta.slug;

    if (tagSet) {
      const has = tags.some((t) => tagSet.has(t.toLowerCase()));
      if (!has) continue;
    }

    out.push({
      filename: f,
      id,
      version: meta?.version ?? 1,
      tags,
      enhanced,
    });
  }
  return out.sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Resolve a user slug / filename to an absolute path, or null.
 */
export async function resolveRoutineFile(cwd: string, slugOrName: string): Promise<string | null> {
  const dir = path.join(cwd, PI_ROUTINES_DIR);
  const direct = path.join(dir, slugOrName);
  try {
    await fs.access(direct);
    return direct;
  } catch {
    /* try glob */
  }
  try {
    const entries = await fs.readdir(dir);
    const base = slugOrName.replace(/\.md$/i, "");
    for (const f of entries) {
      if (!f.endsWith(".md")) continue;
      if (f === slugOrName || f.startsWith(`${base}.v`) || f.replace(/\.md$/, "").startsWith(base)) {
        return path.join(dir, f);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export { isEnhancedRoutineMarkdown, splitFrontmatter, parseRoutineMarkdownLoose };
