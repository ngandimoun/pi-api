import fs from "node:fs/promises";
import path from "node:path";

import { PI_CONSTITUTION_FILE, SYSTEM_STYLE_FILE } from "./constants.js";

/** Surround Pi-managed block for idempotent merge into IDE rule files. */
export const PI_CLI_MARK_START = "<!-- PI_CLI_START -->";
export const PI_CLI_MARK_END = "<!-- PI_CLI_END -->";

export type AgenticInjectionMode = "base" | "explicit" | "auto";

export type AgenticInjectionOptions = {
  mode: AgenticInjectionMode;
  /**
   * Repo-relative POSIX paths to routine markdown files, e.g. `.pi/routines/foo.v1.md`.
   * For `explicit`, pass the primary routine first, then optional linked routines.
   */
  routineRelPaths?: string[];
};

export type AgenticInjectionResult = {
  filesWritten: string[];
  filesSkipped: string[];
};

type TargetSpec = {
  relPath: string;
  /** If false, only merge when the file already exists (avoid surprising new IDE files). */
  createIfMissing: boolean;
};

const DEFAULT_TARGETS: TargetSpec[] = [
  { relPath: ".cursorrules", createIfMissing: false },
  { relPath: "CLAUDE.md", createIfMissing: false },
  { relPath: path.join(".claude", "CLAUDE.md"), createIfMissing: false },
  { relPath: ".clinerules", createIfMissing: true },
  { relPath: path.join(".windsurf", "rules", "pi-context.md"), createIfMissing: true },
];

function normalizeRoutineLines(paths: string[] | undefined): string[] {
  if (!paths?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const x = p.replace(/\\/g, "/").trim();
    if (!x || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

/** Exported for tests — merges or appends the Pi block using marker comments. */
export function mergePiManagedSection(existing: string, piBody: string): string {
  const block = `${PI_CLI_MARK_START}\n${piBody.trim()}\n${PI_CLI_MARK_END}`;
  const start = existing.indexOf(PI_CLI_MARK_START);
  const end = existing.indexOf(PI_CLI_MARK_END);
  if (start >= 0 && end > start) {
    return `${existing.slice(0, start)}${block}${existing.slice(end + PI_CLI_MARK_END.length)}`;
  }
  const sep = existing.trim().length ? "\n\n" : "";
  return `${existing.trimEnd()}${sep}${block}\n`;
}

function buildPiBody(opts: AgenticInjectionOptions): string {
  const lines: string[] = [
    "## Pi (auto-managed)",
    "",
    "Before doing substantial edits, align with this repository’s Pi artifacts:",
    "",
    `- \`${SYSTEM_STYLE_FILE}\` — conventions learned from the codebase`,
    `- \`${PI_CONSTITUTION_FILE}\` — non‑negotiable architecture rules`,
  ];

  const routines = normalizeRoutineLines(opts.routineRelPaths);
  if (routines.length) {
    lines.push("", "For the current task, treat **only** these routine specs as authoritative:", "");
    for (const r of routines) {
      lines.push(`- \`@${r}\` (Cursor) / \`${r}\` (Claude Code & other CLIs)`);
    }
  } else {
    lines.push(
      "",
      "When a Pi routine applies, open **only** the relevant file under `.pi/routines/` (do not bulk-load every routine — token waste)."
    );
  }

  lines.push("", "_This section is maintained by `pi learn` / `pi routine`. Edit other parts of this file freely._");
  return lines.join("\n");
}

async function pathExists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

/**
 * Injects or updates a Pi-managed section in common agentic-IDE config files.
 * Does not blanket-list every routine — pass only task-relevant `routineRelPaths`.
 */
export async function injectPiContextToAllIDEs(
  cwd: string,
  opts: AgenticInjectionOptions
): Promise<AgenticInjectionResult> {
  const piBody = buildPiBody(opts);
  const filesWritten: string[] = [];
  const filesSkipped: string[] = [];

  for (const t of DEFAULT_TARGETS) {
    const rel = t.relPath.replace(/\\/g, "/");
    const abs = path.join(cwd, t.relPath);
    const exists = await pathExists(abs);
    if (!exists && !t.createIfMissing) {
      filesSkipped.push(rel);
      continue;
    }

    let prior = "";
    if (exists) {
      try {
        prior = await fs.readFile(abs, "utf8");
      } catch {
        filesSkipped.push(rel);
        continue;
      }
    } else {
      if (rel.endsWith("pi-context.md")) {
        prior = "---\ndescription: Pi — repository conventions & active routines\ntype: always\n---\n\n";
      }
    }

    const next = mergePiManagedSection(prior, piBody);
    if (next === prior) {
      filesSkipped.push(rel);
      continue;
    }

    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, next, "utf8");
    filesWritten.push(rel);
  }

  return { filesWritten, filesSkipped };
}
