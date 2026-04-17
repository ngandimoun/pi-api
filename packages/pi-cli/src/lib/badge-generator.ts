import fs from "node:fs/promises";
import path from "node:path";

export const PI_BADGE_MARKER = "<!-- pi-cli-badge -->";

const STATIC_BADGE_MD =
  "[![Pi validated](https://img.shields.io/badge/Pi-validated-success)](https://www.npmjs.com/package/@pi-api/cli)";

function badgeLine(dynamicUrl?: string): string {
  const core = dynamicUrl?.trim()
    ? `![Pi](${dynamicUrl.trim()})`
    : STATIC_BADGE_MD;
  return `${PI_BADGE_MARKER} ${core}`;
}

export async function detectReadmeLocation(cwd: string): Promise<string | null> {
  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    const p = path.join(cwd, name);
    try {
      await fs.access(p);
      return p;
    } catch {
      /* continue */
    }
  }
  return null;
}

export type InsertBadgeResult = { path: string; action: "inserted" | "updated" | "skipped"; reason?: string };

/**
 * Insert or refresh the Pi badge line after the first H1 title block, or at top if no H1.
 */
export async function addBadgeToReadme(cwd: string, dynamicBadgeUrl?: string): Promise<InsertBadgeResult> {
  const readmePath = await detectReadmeLocation(cwd);
  if (!readmePath) {
    return { path: "", action: "skipped", reason: "No README.md found in project root." };
  }
  const line = badgeLine(dynamicBadgeUrl);
  let content = await fs.readFile(readmePath, "utf8");

  if (content.includes(PI_BADGE_MARKER)) {
    const lines = content.split("\n");
    const next = lines
      .map((l) => (l.includes(PI_BADGE_MARKER) ? line : l))
      .join("\n");
    await fs.writeFile(readmePath, next, "utf8");
    return { path: readmePath, action: "updated" };
  }

  const lines = content.split("\n");
  let insertIdx = 0;
  const h1 = lines.findIndex((l) => /^#\s+/.test(l.trim()));
  if (h1 >= 0) {
    insertIdx = h1 + 1;
    if (lines[insertIdx]?.trim() === "") insertIdx += 1;
  }
  lines.splice(insertIdx, 0, "", line, "");
  await fs.writeFile(readmePath, lines.join("\n"), "utf8");
  return { path: readmePath, action: "inserted" };
}

export function formatBadgeMarkdown(dynamicBadgeUrl?: string): string {
  return badgeLine(dynamicBadgeUrl);
}
