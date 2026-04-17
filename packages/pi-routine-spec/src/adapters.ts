import type { RoutineSpecification } from "./schema.js";

function lines(...L: string[]): string {
  return L.filter(Boolean).join("\n");
}

/**
 * Cursor Rules (.mdc) — inject as project rule file.
 */
export function toCursorRuleMdc(spec: RoutineSpecification, opts?: { description?: string }): string {
  const desc = opts?.description ?? `Pi routine: ${spec.metadata.id}`;
  return lines(
    "---",
    `description: ${JSON.stringify(desc)}`,
    "globs: []",
    "alwaysApply: false",
    "---",
    "",
    `# Pi routine: ${spec.metadata.id}`,
    "",
    `Intent: ${spec.metadata.intent}`,
    "",
    "Follow the phases and constraints below when working on this task.",
    "",
    spec.context.framework ? `**Stack:** ${spec.context.framework}` : "",
    "",
    "## Constraints",
    ...spec.context.constraints.must_use.map((x) => `- MUST: ${x}`),
    ...spec.context.constraints.must_not.map((x) => `- MUST NOT: ${x}`),
    ...spec.context.constraints.conventions.map((x) => `- CONVENTION: ${x}`),
    "",
    "## Phases (summary)",
    ...spec.phases.flatMap((p) => [`### ${p.title}`, ...p.steps.map((s) => `- [ ] ${s.id}: ${s.description.slice(0, 200)}${s.description.length > 200 ? "…" : ""}`)]),
    ""
  );
}

/**
 * Append-friendly section for AGENTS.md / CLAUDE.md style agent instructions.
 */
export function toClaudeAgentsSection(spec: RoutineSpecification): string {
  return lines(
    `## Pi routine — ${spec.metadata.id}`,
    "",
    `**When this applies:** ${spec.metadata.intent}`,
    "",
    "### Hard rules",
    ...spec.context.constraints.must_use.map((x) => `- ${x}`),
    ...spec.context.constraints.must_not.map((x) => `- Do not: ${x}`),
    "",
    "### Execution order",
    ...spec.phases.map((p, i) => `${i + 1}. **${p.title}** — complete steps ${p.steps.map((s) => s.id).join(", ")}`),
    "",
    "### Verify",
    ...spec.validation.test_commands.map((t) => `- Run: \`${t}\``),
    ""
  );
}

/**
 * Windsurf rule markdown (directory layout may vary; content is portable).
 */
export function toWindsurfRuleMarkdown(spec: RoutineSpecification): string {
  return lines(
    `# Pi routine ${spec.metadata.id}`,
    "",
    `Intent: ${spec.metadata.intent}`,
    "",
    "Constraints:",
    ...spec.context.constraints.must_use.map((x) => `- MUST ${x}`),
    ...spec.context.constraints.must_not.map((x) => `- NEVER ${x}`),
    "",
    "Steps:",
    ...spec.phases.flatMap((p) => p.steps.map((s) => `- ${p.title} / ${s.id}: ${s.description}`)),
    ""
  );
}
