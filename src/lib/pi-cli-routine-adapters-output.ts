import {
  safeParseRoutineSpecification,
  toClaudeAgentsSection,
  toCursorRuleMdc,
  toWindsurfRuleMarkdown,
  type RoutineSpecification,
} from "pi-routine-spec";

export type RoutineFormatId = "cursor" | "claude" | "windsurf";

export function parseRoutineSpecJson(specJson: string | undefined): RoutineSpecification | null {
  if (!specJson?.trim()) return null;
  try {
    const raw = JSON.parse(specJson) as unknown;
    return safeParseRoutineSpecification(raw);
  } catch {
    return null;
  }
}

/**
 * Optional agent-specific text blobs for the CLI to write beside `.pi/routines/*.md`.
 */
export function buildRoutineAdapterOutputs(
  specJson: string | undefined,
  formats: RoutineFormatId[]
): { cursor_mdc?: string; claude_agents_section?: string; windsurf_md?: string } {
  const spec = parseRoutineSpecJson(specJson);
  if (!spec || !formats.length) return {};
  const out: { cursor_mdc?: string; claude_agents_section?: string; windsurf_md?: string } = {};
  for (const f of formats) {
    if (f === "cursor") out.cursor_mdc = toCursorRuleMdc(spec);
    if (f === "claude") out.claude_agents_section = toClaudeAgentsSection(spec);
    if (f === "windsurf") out.windsurf_md = toWindsurfRuleMarkdown(spec);
  }
  return out;
}
