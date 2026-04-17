// src/schema.ts
import { z } from "zod";
var routineStepActionSchema = z.enum([
  "create_file",
  "run_command",
  "modify_file",
  "verify",
  "other"
]);
var routineStepSchema = z.object({
  id: z.string().min(1),
  action: routineStepActionSchema,
  description: z.string().min(1),
  file_path: z.string().optional(),
  command: z.string().optional(),
  critical_rules: z.array(z.string()).default([]),
  validation_checks: z.array(z.string()).default([]),
  depends_on_steps: z.array(z.string()).default([])
});
var routinePhaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(routineStepSchema).min(1),
  depends_on_phases: z.array(z.string()).default([]),
  unlock_condition: z.object({
    type: z.enum(["manual", "check_pass", "test_pass"]),
    details: z.string().optional()
  }).optional()
});
var routineConstraintsSchema = z.object({
  must_use: z.array(z.string()).default([]),
  must_not: z.array(z.string()).default([]),
  conventions: z.array(z.string()).default([])
});
var routineContextBlockSchema = z.object({
  framework: z.string().default(""),
  existing_patterns: z.object({
    imports: z.array(z.string()).default([]),
    components: z.array(z.string()).default([]),
    hooks: z.array(z.string()).default([])
  }).default({ imports: [], components: [], hooks: [] }),
  constraints: routineConstraintsSchema.default({
    must_use: [],
    must_not: [],
    conventions: []
  })
});
var routineValidationSchema = z.object({
  required_files: z.array(z.string()).default([]),
  required_exports: z.array(z.string()).default([]),
  test_commands: z.array(z.string()).default([])
});
var routineMetadataSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  intent: z.string().min(1),
  created_at: z.string().optional(),
  tags: z.array(z.string()).default([]),
  references: z.array(z.string()).default([])
});
var routineFileEntrySchema = z.object({
  path: z.string().min(1),
  purpose: z.string().min(1),
  depends_on: z.array(z.string()).default([]),
  action: z.enum(["create", "modify", "verify"])
});
var routineSpecificationSchema = z.object({
  metadata: routineMetadataSchema,
  context: routineContextBlockSchema,
  /** All repo files this routine creates, modifies, or verifies (executor scope). */
  files_manifest: z.array(routineFileEntrySchema).default([]),
  phases: z.array(routinePhaseSchema).min(1),
  validation: routineValidationSchema.default({
    required_files: [],
    required_exports: [],
    test_commands: []
  })
});

// src/render.ts
import { stringify as yamlStringify } from "yaml";
function esc(s) {
  return s.replace(/\|/g, "\\|");
}
function routineSpecToMarkdown(spec) {
  const fm = {
    pi_routine: "2",
    id: spec.metadata.id,
    version: spec.metadata.version,
    intent: spec.metadata.intent,
    ...spec.metadata.created_at ? { created_at: spec.metadata.created_at } : {},
    tags: spec.metadata.tags,
    references: spec.metadata.references
  };
  const front = yamlStringify(fm).trim();
  const lines2 = [];
  lines2.push(`---`);
  lines2.push(front);
  lines2.push(`---`);
  lines2.push("");
  if (spec.metadata.references.length) {
    lines2.push(
      `> **Depends on prior routines:** ${spec.metadata.references.map((r) => `\`.pi/routines/${r}.v*.md\``).join(", ")}`
    );
    lines2.push(`> Execute those routine files first (in order if numbered), then this one.`);
    lines2.push("");
  }
  lines2.push(`# Pi Execution Routine: ${spec.metadata.id}`);
  lines2.push("");
  lines2.push(`> **Target:** Any coding agent (Cursor, Claude Code, Windsurf, etc.)`);
  lines2.push(`> **Mode:** Specification only \u2014 the executor applies changes; Pi does not run commands.`);
  lines2.push("");
  lines2.push(`## Context`);
  if (spec.context.framework) {
    lines2.push(`**Framework / stack:** ${spec.context.framework}`);
  }
  lines2.push("");
  lines2.push(`### Existing patterns (from repo analysis)`);
  const ep = spec.context.existing_patterns;
  if (ep.imports.length) {
    lines2.push(`**Imports / modules:**`);
    for (const i of ep.imports) lines2.push(`- ${esc(i)}`);
    lines2.push("");
  }
  if (ep.components.length) {
    lines2.push(`**Components:**`);
    for (const c of ep.components) lines2.push(`- ${esc(c)}`);
    lines2.push("");
  }
  if (ep.hooks.length) {
    lines2.push(`**Hooks:**`);
    for (const h of ep.hooks) lines2.push(`- ${esc(h)}`);
    lines2.push("");
  }
  if (!ep.imports.length && !ep.components.length && !ep.hooks.length) {
    lines2.push(`_(none inferred \u2014 follow system style and repo conventions.)_`);
    lines2.push("");
  }
  const cons = spec.context.constraints;
  lines2.push(`### Critical constraints`);
  for (const m of cons.must_use) lines2.push(`- \u2713 MUST: ${esc(m)}`);
  for (const m of cons.must_not) lines2.push(`- \u2717 MUST NOT: ${esc(m)}`);
  for (const m of cons.conventions) lines2.push(`- \u25C6 CONVENTION: ${esc(m)}`);
  if (!cons.must_use.length && !cons.must_not.length && !cons.conventions.length) {
    lines2.push(`_(add constraints as needed.)_`);
  }
  lines2.push("");
  if (spec.metadata.references.length) {
    lines2.push(`## Related Routines`);
    lines2.push(
      `Before this routine, the coding agent should have completed (or read) these saved routines under \`.pi/routines/\`:`
    );
    let i = 1;
    for (const r of spec.metadata.references) {
      lines2.push(`${i}. \`${r}\` \u2014 see \`.pi/routines/${r}.v*.md\``);
      i += 1;
    }
    lines2.push(
      `This document focuses on **integration / glue**; do not duplicate steps already specified there.`
    );
    lines2.push("");
  }
  lines2.push(`## Files This Routine Creates or Modifies`);
  if (spec.files_manifest.length) {
    for (const f of spec.files_manifest) {
      lines2.push(`- **${esc(f.path)}** (\`${f.action}\`): ${esc(f.purpose)}`);
      if (f.depends_on.length) {
        lines2.push(`  - Depends on: ${f.depends_on.map((d) => `\`${esc(d)}\``).join(", ")}`);
      }
    }
  } else {
    lines2.push(
      `_(No explicit manifest \u2014 infer from phases below; prefer multiple focused files over one monolithic file.)_`
    );
  }
  lines2.push("");
  for (const phase of spec.phases) {
    lines2.push(`## ${phase.title}`);
    lines2.push(`<!-- phase_id: ${phase.id} -->`);
    for (const step of phase.steps) {
      lines2.push(`### Step ${step.id}`);
      lines2.push(`**Action:** \`${step.action}\``);
      lines2.push("");
      lines2.push(step.description);
      lines2.push("");
      if (step.file_path) lines2.push(`**File:** \`${step.file_path}\``);
      if (step.command) {
        lines2.push("");
        lines2.push(`**Command (executor runs locally):**`);
        lines2.push("");
        lines2.push("```bash");
        lines2.push(step.command);
        lines2.push("```");
        lines2.push("");
      }
      if (step.critical_rules.length) {
        lines2.push(`**Critical rules:**`);
        for (const r of step.critical_rules) lines2.push(`- ${esc(r)}`);
        lines2.push("");
      }
      if (step.validation_checks.length) {
        lines2.push(`**Validation:**`);
        for (const v of step.validation_checks) lines2.push(`- ${esc(v)}`);
        lines2.push("");
      }
    }
  }
  lines2.push(`## Validation checklist`);
  for (const f of spec.validation.required_files) {
    lines2.push(`- [ ] File exists: \`${f}\``);
  }
  for (const e of spec.validation.required_exports) {
    lines2.push(`- [ ] Export / symbol: \`${e}\``);
  }
  for (const t of spec.validation.test_commands) {
    lines2.push(`- [ ] Command passes: \`${t}\``);
  }
  if (!spec.validation.required_files.length && !spec.validation.required_exports.length && !spec.validation.test_commands.length) {
    lines2.push(`- [ ] Types / lint / tests pass per project standards`);
  }
  lines2.push("");
  return lines2.join("\n");
}

// src/parse.ts
import { parse as yamlParse } from "yaml";
var FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
function splitFrontmatter(markdown) {
  const m = markdown.trim().match(FRONTMATTER_RE);
  if (!m) return null;
  try {
    const frontmatter = yamlParse(m[1]);
    return { frontmatter, body: m[2] };
  } catch {
    return null;
  }
}
function isEnhancedRoutineMarkdown(markdown) {
  const s = splitFrontmatter(markdown);
  return s?.frontmatter?.pi_routine === "2" || s?.frontmatter?.pi_routine === 2;
}
function parseRoutineMarkdownLoose(markdown) {
  const s = splitFrontmatter(markdown);
  if (!s) return null;
  const fm = s.frontmatter;
  const id = typeof fm.id === "string" ? fm.id : "";
  const version = typeof fm.version === "number" ? fm.version : 1;
  const intent = typeof fm.intent === "string" ? fm.intent : "";
  const tags = Array.isArray(fm.tags) ? fm.tags.filter((t) => typeof t === "string") : [];
  const references = Array.isArray(fm.references) ? fm.references.filter((t) => typeof t === "string") : [];
  return {
    meta: { id, version, intent, tags, references },
    raw: s
  };
}
function safeParseRoutineSpecification(data) {
  const r = routineSpecificationSchema.safeParse(data);
  return r.success ? r.data : null;
}
function splitByH2(body) {
  const lines2 = body.split(/\r?\n/);
  const map = /* @__PURE__ */ new Map();
  let cur = null;
  for (const line of lines2) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      cur = h2[1].trim();
      if (!map.has(cur)) map.set(cur, []);
      continue;
    }
    if (cur) map.get(cur).push(line);
  }
  return new Map([...map.entries()].map(([k, v]) => [k, v.join("\n").trimEnd()]));
}
function parseContextSection(text) {
  const framework = text.match(/\*\*Framework \/ stack:\*\*\s*(.+)/)?.[1]?.trim() ?? text.match(/\*\*Framework[^*]*\*\*\s*(.+)/)?.[1]?.trim() ?? "";
  const imports = [];
  const components = [];
  const hooks = [];
  let mode = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\*\*Imports/.test(line)) {
      mode = "imports";
      continue;
    }
    if (/^\*\*Components/.test(line)) {
      mode = "components";
      continue;
    }
    if (/^\*\*Hooks/.test(line)) {
      mode = "hooks";
      continue;
    }
    const m = line.match(/^\s*-\s+(.+)$/);
    if (m && mode) {
      const val = m[1].trim();
      if (mode === "imports") imports.push(val);
      else if (mode === "components") components.push(val);
      else hooks.push(val);
    }
  }
  const must_use = [];
  const must_not = [];
  const conventions = [];
  for (const line of text.split(/\r?\n/)) {
    const mu = line.match(/^\s*-\s*✓\s*MUST:\s*(.+)$/);
    if (mu) {
      must_use.push(mu[1].trim());
      continue;
    }
    const mn = line.match(/^\s*-\s*✗\s*MUST NOT:\s*(.+)$/);
    if (mn) {
      must_not.push(mn[1].trim());
      continue;
    }
    const co = line.match(/^\s*-\s*◆\s*CONVENTION:\s*(.+)$/);
    if (co) conventions.push(co[1].trim());
  }
  return {
    framework,
    existing_patterns: { imports, components, hooks },
    constraints: { must_use, must_not, conventions }
  };
}
function parseFilesManifest(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*\*\*([^*]+)\*\*\s*\(`([^`]+)`\):\s*(.+)$/);
    if (m) {
      const action = m[2];
      if (action === "create" || action === "modify" || action === "verify") {
        out.push({ path: m[1].trim(), purpose: m[3].trim(), depends_on: [], action });
      }
      continue;
    }
    const m2 = line.match(/^\s*-\s*\*\*([^*]+)\*\*:\s*(.+)$/);
    if (m2) {
      out.push({
        path: m2[1].trim(),
        purpose: m2[2].trim(),
        depends_on: [],
        action: "modify"
      });
    }
  }
  return out;
}
function parsePhaseBlock(title, text) {
  const phaseId = text.match(/<!--\s*phase_id:\s*([^>]+)\s*-->/)?.[1]?.trim() ?? title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const steps = [];
  const chunks = text.split(/\n(?=### Step )/);
  for (const chunk of chunks) {
    if (!/^### Step /.test(chunk.trim())) continue;
    const stepId = chunk.match(/^### Step\s+(\S+)/m)?.[1] ?? chunk.match(/^### Step\s+(.+)$/m)?.[1]?.trim() ?? "step";
    const actionRaw = chunk.match(/\*\*Action:\*\*\s*`([^`]+)`/)?.[1] ?? "other";
    const action = ["create_file", "run_command", "modify_file", "verify", "other"].includes(actionRaw) ? actionRaw : "other";
    const desc = chunk.split(/\*\*Action:\*\*/)[1]?.replace(/^[\s\S]*?\n\n/, "").split(/\*\*File:\*\*/)[0]?.trim() ?? chunk.replace(/^### Step[^\n]*\n+/, "").trim();
    const file_path = chunk.match(/\*\*File:\*\*\s*`([^`]+)`/)?.[1];
    const cmdMatch = chunk.match(/```bash\r?\n([\s\S]*?)```/);
    const command = cmdMatch?.[1]?.trim();
    const critical_rules = [];
    const cr = chunk.match(/\*\*Critical rules:\*\*([\s\S]*?)(?=\*\*Validation:\*\*|$)/);
    if (cr) {
      for (const ln of cr[1].split(/\r?\n/)) {
        const x = ln.match(/^\s*-\s+(.+)$/);
        if (x) critical_rules.push(x[1].trim());
      }
    }
    const validation_checks = [];
    const vc = chunk.match(/\*\*Validation:\*\*([\s\S]*?)$/);
    if (vc) {
      for (const ln of vc[1].split(/\r?\n/)) {
        const x = ln.match(/^\s*-\s+(.+)$/);
        if (x) validation_checks.push(x[1].trim());
      }
    }
    steps.push({
      id: stepId,
      action,
      description: desc || title,
      ...file_path ? { file_path } : {},
      ...command ? { command } : {},
      critical_rules,
      validation_checks,
      depends_on_steps: []
    });
  }
  if (!steps.length) {
    steps.push({
      id: `${phaseId}-placeholder`,
      action: "other",
      description: text.trim() || title,
      critical_rules: [],
      validation_checks: [],
      depends_on_steps: []
    });
  }
  return {
    id: phaseId,
    title,
    steps,
    depends_on_phases: []
  };
}
function parseValidationChecklist(text) {
  const required_files = [];
  const required_exports = [];
  const test_commands = [];
  for (const line of text.split(/\r?\n/)) {
    let m = line.match(/`- \[ \] File exists:\s*`([^`]+)`/);
    if (m) {
      required_files.push(m[1].trim());
      continue;
    }
    m = line.match(/`- \[ \] Export[^`]*`([^`]+)`/);
    if (m) {
      required_exports.push(m[1].trim());
      continue;
    }
    m = line.match(/`- \[ \] Command passes:\s*`([^`]+)`/);
    if (m) test_commands.push(m[1].trim());
  }
  return { required_files, required_exports, test_commands };
}
function parseRoutineMarkdownFull(markdown) {
  if (!isEnhancedRoutineMarkdown(markdown)) return null;
  const loose = parseRoutineMarkdownLoose(markdown);
  if (!loose?.meta.id || !loose.meta.intent) return null;
  const s = splitFrontmatter(markdown);
  if (!s) return null;
  const fm = s.frontmatter;
  const sections = splitByH2(s.body);
  const contextText = sections.get("Context") ?? "";
  const context = parseContextSection(contextText);
  const filesText = sections.get("Files This Routine Creates or Modifies") ?? "";
  const files_manifest = parseFilesManifest(filesText);
  const validationText = sections.get("Validation checklist") ?? "";
  const validation = parseValidationChecklist(validationText);
  const skip = /* @__PURE__ */ new Set([
    "Context",
    "Related Routines",
    "Files This Routine Creates or Modifies",
    "Validation checklist"
  ]);
  const phases = [];
  for (const [title, block] of sections.entries()) {
    if (skip.has(title)) continue;
    if (title.startsWith("Pi Execution Routine:")) continue;
    const phase = parsePhaseBlock(title, block);
    if (phase) phases.push(phase);
  }
  if (!phases.length) {
    phases.push({
      id: "default",
      title: "Phase 1",
      steps: [
        {
          id: "s1",
          action: "other",
          description: s.body.trim().slice(0, 2e3) || loose.meta.intent,
          critical_rules: [],
          validation_checks: [],
          depends_on_steps: []
        }
      ],
      depends_on_phases: []
    });
  }
  const raw = {
    metadata: {
      id: loose.meta.id,
      version: loose.meta.version ?? 1,
      intent: loose.meta.intent,
      ...typeof fm.created_at === "string" ? { created_at: fm.created_at } : {},
      tags: loose.meta.tags ?? [],
      references: loose.meta.references ?? []
    },
    context,
    files_manifest,
    phases,
    validation
  };
  const parsed = routineSpecificationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// src/adapters.ts
function lines(...L) {
  return L.filter(Boolean).join("\n");
}
function toCursorRuleMdc(spec, opts) {
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
    ...spec.phases.flatMap((p) => [`### ${p.title}`, ...p.steps.map((s) => `- [ ] ${s.id}: ${s.description.slice(0, 200)}${s.description.length > 200 ? "\u2026" : ""}`)]),
    ""
  );
}
function toClaudeAgentsSection(spec) {
  return lines(
    `## Pi routine \u2014 ${spec.metadata.id}`,
    "",
    `**When this applies:** ${spec.metadata.intent}`,
    "",
    "### Hard rules",
    ...spec.context.constraints.must_use.map((x) => `- ${x}`),
    ...spec.context.constraints.must_not.map((x) => `- Do not: ${x}`),
    "",
    "### Execution order",
    ...spec.phases.map((p, i) => `${i + 1}. **${p.title}** \u2014 complete steps ${p.steps.map((s) => s.id).join(", ")}`),
    "",
    "### Verify",
    ...spec.validation.test_commands.map((t) => `- Run: \`${t}\``),
    ""
  );
}
function toWindsurfRuleMarkdown(spec) {
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

// src/template.ts
import { z as z2 } from "zod";
var templateCategorySchema = z2.enum([
  "auth",
  "storage",
  "ui",
  "api",
  "deployment",
  "testing",
  "ai",
  "agent",
  "workflow",
  "backend",
  "integration",
  "database",
  "realtime",
  "infrastructure"
]);
var routineTemplateSchema = z2.object({
  id: z2.string().min(1),
  name: z2.string().min(1),
  description: z2.string().min(1),
  category: templateCategorySchema,
  stack: z2.array(z2.string()),
  routine_spec: routineSpecificationSchema
});

// src/execution-plan.ts
import { z as z3 } from "zod";
var executionPlanRoutineRefSchema = z3.object({
  routine_id: z3.string().min(1),
  routine_file: z3.string().min(1),
  execution_order: z3.number().int().min(1),
  reason: z3.string().min(1)
});
var executionPlanGlueSchema = z3.object({
  routine_id: z3.string().min(1),
  description: z3.string().min(1)
});
var executionPlanSchema = z3.object({
  plan_id: z3.string().min(1),
  intent: z3.string().min(1),
  routines: z3.array(executionPlanRoutineRefSchema).min(1),
  glue_routine: executionPlanGlueSchema.optional()
});
function renderExecutionPlan(plan) {
  const lines2 = [];
  lines2.push(`---`);
  lines2.push(`pi_execution_plan: "1"`);
  lines2.push(`plan_id: ${plan.plan_id}`);
  lines2.push(`intent: "${plan.intent.replace(/"/g, '\\"')}"`);
  lines2.push(`---`);
  lines2.push("");
  lines2.push(`# Pi Execution Plan: ${plan.plan_id}`);
  lines2.push("");
  lines2.push(`This intent spans multiple saved routines. Execute in order:`);
  lines2.push("");
  for (const r of [...plan.routines].sort((a, b) => a.execution_order - b.execution_order)) {
    lines2.push(`${r.execution_order}. **${r.routine_id}** \u2014 ${r.reason}`);
    lines2.push(`   File: \`${r.routine_file}\``);
    lines2.push("");
  }
  if (plan.glue_routine) {
    lines2.push(`Then execute the integration routine:`);
    lines2.push(`- **${plan.glue_routine.routine_id}** \u2014 ${plan.glue_routine.description}`);
    lines2.push("");
  }
  lines2.push(`## For the coding agent`);
  lines2.push("");
  lines2.push(
    `Read and execute each routine file in order. Each routine's \`files_manifest\` lists what it creates or touches.`
  );
  lines2.push("");
  return lines2.join("\n");
}

// src/drift.ts
function normalizePath(p) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}
function detectRoutineDrift(changedFiles, routineSpec, opts) {
  const violations = [];
  const id = routineSpec.metadata.id;
  const manifest = routineSpec.files_manifest ?? [];
  const manifestPaths = new Set(manifest.map((f) => normalizePath(f.path)));
  const changed = changedFiles.map(normalizePath);
  for (const f of manifest.filter((x) => x.action === "create")) {
    const p = normalizePath(f.path);
    if (!changed.includes(p)) {
      violations.push({
        routine_id: id,
        type: "missing_file",
        message: `Expected create manifest path not in changed set: ${p}`,
        file: p
      });
    }
  }
  for (const file of changed) {
    if (!manifestPaths.has(file)) {
      violations.push({
        routine_id: id,
        type: "unexpected_file",
        message: `Changed file not listed in routine files_manifest: ${file}`,
        file
      });
    }
  }
  const contents = opts?.fileContents;
  if (contents?.size) {
    const { must_use: mu, must_not: mn } = routineSpec.context.constraints;
    for (const [relPath, text] of contents) {
      const n = normalizePath(relPath);
      for (const forbidden of mn ?? []) {
        if (forbidden.trim() && text.includes(forbidden)) {
          violations.push({
            routine_id: id,
            type: "constraint_violation",
            message: `must_not pattern found in ${n}: ${forbidden.slice(0, 120)}`,
            file: n
          });
        }
      }
      for (const required of mu ?? []) {
        if (required.trim() && !text.includes(required)) {
          violations.push({
            routine_id: id,
            type: "constraint_violation",
            message: `must_use pattern missing in ${n}: ${required.slice(0, 120)}`,
            file: n
          });
        }
      }
    }
  }
  return violations;
}
export {
  detectRoutineDrift,
  executionPlanGlueSchema,
  executionPlanRoutineRefSchema,
  executionPlanSchema,
  isEnhancedRoutineMarkdown,
  parseRoutineMarkdownFull,
  parseRoutineMarkdownLoose,
  renderExecutionPlan,
  routineConstraintsSchema,
  routineContextBlockSchema,
  routineFileEntrySchema,
  routineMetadataSchema,
  routinePhaseSchema,
  routineSpecToMarkdown,
  routineSpecificationSchema,
  routineStepActionSchema,
  routineStepSchema,
  routineTemplateSchema,
  routineValidationSchema,
  safeParseRoutineSpecification,
  splitFrontmatter,
  templateCategorySchema,
  toClaudeAgentsSection,
  toCursorRuleMdc,
  toWindsurfRuleMarkdown
};
