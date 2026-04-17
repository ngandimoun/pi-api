import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";

import {
  safeParseRoutineSpecification,
  toClaudeAgentsSection,
  toCursorRuleMdc,
  toWindsurfRuleMarkdown,
} from "pi-routine-spec";

export type RoutineFormatId = "cursor" | "claude" | "windsurf";

export function buildLocalAdapterFiles(
  routineSpecJson: string | undefined,
  slug: string,
  formats: RoutineFormatId[]
): { relPath: string; content: string }[] {
  if (!routineSpecJson?.trim() || !formats.length) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(routineSpecJson) as unknown;
  } catch {
    return [];
  }
  const spec = safeParseRoutineSpecification(raw);
  if (!spec) return [];

  const out: { relPath: string; content: string }[] = [];
  for (const f of formats) {
    if (f === "cursor") {
      out.push({ relPath: path.join(".cursor", "rules", `${slug}.mdc`), content: toCursorRuleMdc(spec) });
    }
    if (f === "claude") {
      out.push({
        relPath: path.join(".pi", "adapters", "claude", `${slug}.md`),
        content: toClaudeAgentsSection(spec),
      });
    }
    if (f === "windsurf") {
      out.push({
        relPath: path.join(".windsurf", "rules", `${slug}.md`),
        content: toWindsurfRuleMarkdown(spec),
      });
    }
  }
  return out;
}

export async function writeAdapterFiles(
  cwd: string,
  slug: string,
  routineSpecJson: string | undefined,
  formats: RoutineFormatId[]
): Promise<void> {
  const files = buildLocalAdapterFiles(routineSpecJson, slug, formats);
  for (const { relPath, content } of files) {
    const abs = path.join(cwd, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
    console.log(chalk.green("✓"), "Wrote:", relPath);
  }
}
