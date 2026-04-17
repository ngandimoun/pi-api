import { stringify as yamlStringify } from "yaml";

import type { RoutineSpecification } from "./schema.js";

function esc(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/**
 * Render a Pi routine as Markdown with YAML frontmatter (machine- and human-readable).
 */
export function routineSpecToMarkdown(spec: RoutineSpecification): string {
  const fm = {
    pi_routine: "2",
    id: spec.metadata.id,
    version: spec.metadata.version,
    intent: spec.metadata.intent,
    ...(spec.metadata.created_at ? { created_at: spec.metadata.created_at } : {}),
    tags: spec.metadata.tags,
    references: spec.metadata.references,
  };
  const front = yamlStringify(fm).trim();

  const lines: string[] = [];
  lines.push(`---`);
  lines.push(front);
  lines.push(`---`);
  lines.push("");
  if (spec.metadata.references.length) {
    lines.push(
      `> **Depends on prior routines:** ${spec.metadata.references.map((r) => `\`.pi/routines/${r}.v*.md\``).join(", ")}`
    );
    lines.push(`> Execute those routine files first (in order if numbered), then this one.`);
    lines.push("");
  }
  lines.push(`# Pi Execution Routine: ${spec.metadata.id}`);
  lines.push("");
  lines.push(`> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)`);
  lines.push(`> **Mode:** Specification only — the executor applies changes; Pi does not run commands.`);
  lines.push("");

  lines.push(`## Context`);
  if (spec.context.framework) {
    lines.push(`**Framework / stack:** ${spec.context.framework}`);
  }
  lines.push("");
  lines.push(`### Existing patterns (from repo analysis)`);
  const ep = spec.context.existing_patterns;
  if (ep.imports.length) {
    lines.push(`**Imports / modules:**`);
    for (const i of ep.imports) lines.push(`- ${esc(i)}`);
    lines.push("");
  }
  if (ep.components.length) {
    lines.push(`**Components:**`);
    for (const c of ep.components) lines.push(`- ${esc(c)}`);
    lines.push("");
  }
  if (ep.hooks.length) {
    lines.push(`**Hooks:**`);
    for (const h of ep.hooks) lines.push(`- ${esc(h)}`);
    lines.push("");
  }
  if (!ep.imports.length && !ep.components.length && !ep.hooks.length) {
    lines.push(`_(none inferred — follow system style and repo conventions.)_`);
    lines.push("");
  }

  const cons = spec.context.constraints;
  lines.push(`### Critical constraints`);
  for (const m of cons.must_use) lines.push(`- ✓ MUST: ${esc(m)}`);
  for (const m of cons.must_not) lines.push(`- ✗ MUST NOT: ${esc(m)}`);
  for (const m of cons.conventions) lines.push(`- ◆ CONVENTION: ${esc(m)}`);
  if (!cons.must_use.length && !cons.must_not.length && !cons.conventions.length) {
    lines.push(`_(add constraints as needed.)_`);
  }
  lines.push("");

  if (spec.metadata.references.length) {
    lines.push(`## Related Routines`);
    lines.push(
      `Before this routine, the coding agent should have completed (or read) these saved routines under \`.pi/routines/\`:`
    );
    let i = 1;
    for (const r of spec.metadata.references) {
      lines.push(`${i}. \`${r}\` — see \`.pi/routines/${r}.v*.md\``);
      i += 1;
    }
    lines.push(
      `This document focuses on **integration / glue**; do not duplicate steps already specified there.`
    );
    lines.push("");
  }

  lines.push(`## Files This Routine Creates or Modifies`);
  if (spec.files_manifest.length) {
    for (const f of spec.files_manifest) {
      lines.push(`- **${esc(f.path)}** (\`${f.action}\`): ${esc(f.purpose)}`);
      if (f.depends_on.length) {
        lines.push(`  - Depends on: ${f.depends_on.map((d) => `\`${esc(d)}\``).join(", ")}`);
      }
    }
  } else {
    lines.push(
      `_(No explicit manifest — infer from phases below; prefer multiple focused files over one monolithic file.)_`
    );
  }
  lines.push("");

  for (const phase of spec.phases) {
    lines.push(`## ${phase.title}`);
    lines.push(`<!-- phase_id: ${phase.id} -->`);
    for (const step of phase.steps) {
      lines.push(`### Step ${step.id}`);
      lines.push(`**Action:** \`${step.action}\``);
      lines.push("");
      lines.push(step.description);
      lines.push("");
      if (step.file_path) lines.push(`**File:** \`${step.file_path}\``);
      if (step.command) {
        lines.push("");
        lines.push(`**Command (executor runs locally):**`);
        lines.push("");
        lines.push("```bash");
        lines.push(step.command);
        lines.push("```");
        lines.push("");
      }
      if (step.critical_rules.length) {
        lines.push(`**Critical rules:**`);
        for (const r of step.critical_rules) lines.push(`- ${esc(r)}`);
        lines.push("");
      }
      if (step.validation_checks.length) {
        lines.push(`**Validation:**`);
        for (const v of step.validation_checks) lines.push(`- ${esc(v)}`);
        lines.push("");
      }
    }
  }

  lines.push(`## Validation checklist`);
  for (const f of spec.validation.required_files) {
    lines.push(`- [ ] File exists: \`${f}\``);
  }
  for (const e of spec.validation.required_exports) {
    lines.push(`- [ ] Export / symbol: \`${e}\``);
  }
  for (const t of spec.validation.test_commands) {
    lines.push(`- [ ] Command passes: \`${t}\``);
  }
  if (
    !spec.validation.required_files.length &&
    !spec.validation.required_exports.length &&
    !spec.validation.test_commands.length
  ) {
    lines.push(`- [ ] Types / lint / tests pass per project standards`);
  }
  lines.push("");

  return lines.join("\n");
}
