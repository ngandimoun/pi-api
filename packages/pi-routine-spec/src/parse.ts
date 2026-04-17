import { parse as yamlParse } from "yaml";

import {
  routineSpecificationSchema,
  type RoutineFileEntry,
  type RoutinePhase,
  type RoutineSpecification,
  type RoutineStep,
} from "./schema.js";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export type ParsedRoutineFile = {
  frontmatter: Record<string, unknown>;
  body: string;
};

/**
 * Split YAML frontmatter from markdown body (generic).
 */
export function splitFrontmatter(markdown: string): ParsedRoutineFile | null {
  const m = markdown.trim().match(FRONTMATTER_RE);
  if (!m) return null;
  try {
    const frontmatter = yamlParse(m[1]) as Record<string, unknown>;
    return { frontmatter, body: m[2] };
  } catch {
    return null;
  }
}

/**
 * True if markdown looks like an enhanced Pi routine (v2 frontmatter).
 */
export function isEnhancedRoutineMarkdown(markdown: string): boolean {
  const s = splitFrontmatter(markdown);
  return s?.frontmatter?.pi_routine === "2" || s?.frontmatter?.pi_routine === 2;
}

/**
 * Parse enhanced routine body into structured spec when possible (best-effort).
 * Full round-trip is via server-generated JSON embedded in frontmatter in future;
 * for v2 we primarily validate metadata and keep phases in markdown.
 */
export function parseRoutineMarkdownLoose(markdown: string): {
  meta: Partial<RoutineSpecification["metadata"]>;
  raw: ParsedRoutineFile;
} | null {
  const s = splitFrontmatter(markdown);
  if (!s) return null;
  const fm = s.frontmatter;
  const id = typeof fm.id === "string" ? fm.id : "";
  const version = typeof fm.version === "number" ? fm.version : 1;
  const intent = typeof fm.intent === "string" ? fm.intent : "";
  const tags = Array.isArray(fm.tags) ? fm.tags.filter((t): t is string => typeof t === "string") : [];
  const references = Array.isArray(fm.references)
    ? fm.references.filter((t): t is string => typeof t === "string")
    : [];
  return {
    meta: { id, version, intent, tags, references },
    raw: s,
  };
}

/** Validate a full RoutineSpecification object. */
export function safeParseRoutineSpecification(data: unknown): RoutineSpecification | null {
  const r = routineSpecificationSchema.safeParse(data);
  return r.success ? r.data : null;
}

function splitByH2(body: string): Map<string, string> {
  const lines = body.split(/\r?\n/);
  const map = new Map<string, string[]>();
  let cur: string | null = null;
  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      cur = h2[1].trim();
      if (!map.has(cur)) map.set(cur, []);
      continue;
    }
    if (cur) map.get(cur)!.push(line);
  }
  return new Map([...map.entries()].map(([k, v]) => [k, v.join("\n").trimEnd()]));
}

function parseContextSection(text: string): RoutineSpecification["context"] {
  const framework =
    text.match(/\*\*Framework \/ stack:\*\*\s*(.+)/)?.[1]?.trim() ??
    text.match(/\*\*Framework[^*]*\*\*\s*(.+)/)?.[1]?.trim() ??
    "";
  const imports: string[] = [];
  const components: string[] = [];
  const hooks: string[] = [];
  let mode: "imports" | "components" | "hooks" | null = null;
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
  const must_use: string[] = [];
  const must_not: string[] = [];
  const conventions: string[] = [];
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
    constraints: { must_use, must_not, conventions },
  };
}

function parseFilesManifest(text: string): RoutineFileEntry[] {
  const out: RoutineFileEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*\*\*([^*]+)\*\*\s*\(`([^`]+)`\):\s*(.+)$/);
    if (m) {
      const action = m[2] as RoutineFileEntry["action"];
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
        action: "modify",
      });
    }
  }
  return out;
}

function parsePhaseBlock(title: string, text: string): RoutinePhase | null {
  const phaseId =
    text.match(/<!--\s*phase_id:\s*([^>]+)\s*-->/)?.[1]?.trim() ??
    title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  const steps: RoutineStep[] = [];
  const chunks = text.split(/\n(?=### Step )/);
  for (const chunk of chunks) {
    if (!/^### Step /.test(chunk.trim())) continue;
    const stepId =
      chunk.match(/^### Step\s+(\S+)/m)?.[1] ??
      chunk.match(/^### Step\s+(.+)$/m)?.[1]?.trim() ??
      "step";
    const actionRaw = chunk.match(/\*\*Action:\*\*\s*`([^`]+)`/)?.[1] ?? "other";
    const action = (["create_file", "run_command", "modify_file", "verify", "other"].includes(actionRaw)
      ? actionRaw
      : "other") as RoutineStep["action"];
    const desc =
      chunk
        .split(/\*\*Action:\*\*/)[1]
        ?.replace(/^[\s\S]*?\n\n/, "")
        .split(/\*\*File:\*\*/)[0]
        ?.trim() ?? chunk.replace(/^### Step[^\n]*\n+/, "").trim();
    const file_path = chunk.match(/\*\*File:\*\*\s*`([^`]+)`/)?.[1];
    const cmdMatch = chunk.match(/```bash\r?\n([\s\S]*?)```/);
    const command = cmdMatch?.[1]?.trim();
    const critical_rules: string[] = [];
    const cr = chunk.match(/\*\*Critical rules:\*\*([\s\S]*?)(?=\*\*Validation:\*\*|$)/);
    if (cr) {
      for (const ln of cr[1].split(/\r?\n/)) {
        const x = ln.match(/^\s*-\s+(.+)$/);
        if (x) critical_rules.push(x[1].trim());
      }
    }
    const validation_checks: string[] = [];
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
      ...(file_path ? { file_path } : {}),
      ...(command ? { command } : {}),
      critical_rules,
      validation_checks,
      depends_on_steps: [],
    });
  }
  if (!steps.length) {
    steps.push({
      id: `${phaseId}-placeholder`,
      action: "other",
      description: text.trim() || title,
      critical_rules: [],
      validation_checks: [],
      depends_on_steps: [],
    });
  }
  return {
    id: phaseId,
    title,
    steps,
    depends_on_phases: [],
  };
}

function parseValidationChecklist(text: string): RoutineSpecification["validation"] {
  const required_files: string[] = [];
  const required_exports: string[] = [];
  const test_commands: string[] = [];
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

/**
 * Parse a v2 routine markdown (as produced by `routineSpecToMarkdown`) into a full `RoutineSpecification`.
 * Best-effort: tolerates minor formatting differences; validates with Zod at the end.
 */
export function parseRoutineMarkdownFull(markdown: string): RoutineSpecification | null {
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

  const skip = new Set([
    "Context",
    "Related Routines",
    "Files This Routine Creates or Modifies",
    "Validation checklist",
  ]);

  const phases: RoutinePhase[] = [];
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
          description: s.body.trim().slice(0, 2000) || loose.meta.intent,
          critical_rules: [],
          validation_checks: [],
          depends_on_steps: [],
        },
      ],
      depends_on_phases: [],
    });
  }

  const raw = {
    metadata: {
      id: loose.meta.id,
      version: loose.meta.version ?? 1,
      intent: loose.meta.intent,
      ...(typeof fm.created_at === "string" ? { created_at: fm.created_at } : {}),
      tags: loose.meta.tags ?? [],
      references: loose.meta.references ?? [],
    },
    context,
    files_manifest,
    phases,
    validation,
  };

  const parsed = routineSpecificationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
