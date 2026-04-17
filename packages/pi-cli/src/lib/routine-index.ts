import fs from "node:fs/promises";
import path from "node:path";
import { parseRoutineMarkdownLoose, type RoutineSpecification } from "pi-routine-spec";

import { PI_ROUTINES_DIR } from "./constants.js";

/** Extract repo-relative paths from the v2 "Files This Routine Creates or Modifies" section. */
export function extractFilesManifestPaths(markdown: string): string[] {
  const m = markdown.match(/## Files This Routine Creates or Modifies\r?\n([\s\S]*?)(?=\r?\n## |\r?\n# |\r?\n*$)/);
  if (!m) return [];
  const block = m[1] ?? "";
  const paths: string[] = [];
  const re = /^- \*\*([^*]+)\*\*/gm;
  let x: RegExpExecArray | null;
  while ((x = re.exec(block)) !== null) paths.push(x[1].trim());
  return paths;
}

/**
 * Build a minimal RoutineSpecification for drift checks when only markdown is available.
 */
function extractConstraintsFromMarkdown(markdown: string): { must_use: string[]; must_not: string[]; conventions: string[] } {
  const must_use: string[] = [];
  const must_not: string[] = [];
  const conventions: string[] = [];
  const m = markdown.match(/### Critical constraints\r?\n([\s\S]*?)(?=\r?\n### |\r?\n## |\r?\n*$)/);
  const block = m?.[1] ?? "";
  for (const line of block.split("\n")) {
    const u = line.match(/- ✓ MUST:\s*(.+)/);
    if (u?.[1]) must_use.push(u[1].trim());
    const n = line.match(/- ✗ MUST NOT:\s*(.+)/);
    if (n?.[1]) must_not.push(n[1].trim());
    const c = line.match(/- ◆ CONVENTION:\s*(.+)/);
    if (c?.[1]) conventions.push(c[1].trim());
  }
  return { must_use, must_not, conventions };
}

export function buildRoutineSpecForDriftFromMarkdown(markdown: string, idFallback: string): RoutineSpecification {
  const loose = parseRoutineMarkdownLoose(markdown);
  const paths = extractFilesManifestPaths(markdown);
  const id = loose?.meta.id?.trim() || idFallback;
  const intent = loose?.meta.intent ?? "";
  const version = loose?.meta.version ?? 1;
  const tags = loose?.meta.tags ?? [];
  const references = loose?.meta.references ?? [];
  const cons = extractConstraintsFromMarkdown(markdown);
  return {
    metadata: { id, version, intent, tags, references },
    context: {
      framework: "",
      existing_patterns: { imports: [], components: [], hooks: [] },
      constraints: cons,
    },
    files_manifest: paths.map((p) => ({
      path: p,
      purpose: "Listed in routine markdown",
      depends_on: [],
      action: "create" as const,
    })),
    phases: [
      {
        id: "drift-placeholder",
        title: "Imported",
        steps: [
          {
            id: "s1",
            action: "verify",
            description: "Placeholder for drift detection from markdown manifest",
            critical_rules: [],
            validation_checks: [],
          },
        ],
      },
    ],
    validation: { required_files: [], required_exports: [], test_commands: [] },
  };
}

export const ROUTINE_INDEX_FILENAME = ".index.json";

export type RoutineIndexEntry = {
  id: string;
  version: number;
  intent: string;
  tags: string[];
  files_manifest: string[];
  references: string[];
  created_at: string;
  file_path: string;
};

function parseFilenameMeta(name: string): { slug: string; version: number } | null {
  const m = name.match(/^(.+)\.v(\d+)\.md$/);
  if (!m) return null;
  return { slug: m[1], version: Number.parseInt(m[2], 10) || 1 };
}

/**
 * Scan `.pi/routines/*.md`, parse frontmatter, write `.pi/routines/.index.json`.
 */
export async function rebuildRoutineIndex(cwd: string): Promise<RoutineIndexEntry[]> {
  const dir = path.join(cwd, PI_ROUTINES_DIR);
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }

  const entries: RoutineIndexEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(".md") || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    let raw = "";
    try {
      raw = await fs.readFile(full, "utf8");
    } catch {
      continue;
    }
    const loose = parseRoutineMarkdownLoose(raw);
    const meta = parseFilenameMeta(name);
    const id = loose?.meta.id?.trim() || meta?.slug || name.replace(/\.md$/, "");
    const version = loose?.meta.version ?? meta?.version ?? 1;
    const intent = loose?.meta.intent ?? "";
    const tags = loose?.meta.tags ?? [];
    const references = loose?.meta.references ?? [];

    const fm = loose?.raw.frontmatter as Record<string, unknown> | undefined;
    let files_manifest: string[] = [];
    if (fm && Array.isArray(fm.files_manifest)) {
      files_manifest = fm.files_manifest
        .map((x) => {
          if (typeof x === "object" && x !== null && "path" in x && typeof (x as { path: string }).path === "string") {
            return (x as { path: string }).path;
          }
          return null;
        })
        .filter((x): x is string => Boolean(x));
    }
    if (!files_manifest.length) {
      files_manifest = extractFilesManifestPaths(raw);
    }

    const created_at =
      typeof fm?.created_at === "string"
        ? fm.created_at
        : new Date().toISOString();

    entries.push({
      id,
      version,
      intent,
      tags,
      files_manifest,
      references,
      created_at,
      file_path: path.join(PI_ROUTINES_DIR, name).replace(/\\/g, "/"),
    });
  }

  entries.sort((a, b) => a.file_path.localeCompare(b.file_path));

  const indexPath = path.join(dir, ROUTINE_INDEX_FILENAME);
  await fs.writeFile(indexPath, JSON.stringify({ generated_at: new Date().toISOString(), entries }, null, 2), "utf8");

  return entries;
}

export type RoutineIndexFile = {
  generated_at?: string;
  entries: RoutineIndexEntry[];
};

/**
 * Read `.index.json`, rebuilding if missing.
 */
export async function getRoutineIndex(cwd: string): Promise<RoutineIndexEntry[]> {
  const indexPath = path.join(cwd, PI_ROUTINES_DIR, ROUTINE_INDEX_FILENAME);
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as RoutineIndexFile;
    if (Array.isArray(parsed.entries)) return parsed.entries;
  } catch {
    /* rebuild */
  }
  return rebuildRoutineIndex(cwd);
}

/** Who references each routine id (reverse index). */
export function buildReferenceMap(entries: RoutineIndexEntry[]): Map<string, string[]> {
  const rev = new Map<string, Set<string>>();
  for (const e of entries) {
    for (const ref of e.references) {
      const k = ref.trim();
      if (!k) continue;
      if (!rev.has(k)) rev.set(k, new Set());
      rev.get(k)!.add(e.id);
    }
  }
  const out = new Map<string, string[]>();
  for (const [k, v] of rev) out.set(k, [...v].sort());
  return out;
}
