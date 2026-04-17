import fs from "node:fs/promises";
import path from "node:path";
import * as clack from "@clack/prompts";
import { intro, isCancel, outro, text } from "@clack/prompts";
import chalk from "chalk";
import clipboardy from "clipboardy";

import { PiApiClient } from "../lib/api-client.js";
import { printLocalFirstBanner } from "../lib/cli-capabilities.js";
import {
  PI_CONSTITUTION_FILE,
  PI_HANDOFF_FILE,
  PI_LAST_VALIDATE_RESULT,
  PI_RESONANCE_DIR,
  SYSTEM_STYLE_FILE,
} from "../lib/constants.js";
import { CommandTaskTracker } from "../lib/task-tracker.js";
import { getChangedHunksLegacy, getCurrentBranch, getPendingChanges } from "../lib/vcs/index.js";
import { redactSource } from "../lib/privacy/redactor.js";
import { collectRoutineRepoContext, type RoutineContextPayload } from "../lib/routine-repo-context.js";
import { slugFromIntentLocal } from "./prompt.js";
import {
  ensurePiDir,
  ensureTeamSyncIfNeeded,
  ensureSystemStyleJson,
  type PreFlightGlobalOpts,
} from "../lib/dependency-chain.js";
import { getTaskById, saveTaskRecord } from "../lib/task-store.js";
import { loadSessions, upsertActiveSession } from "../lib/session-store.js";
import { createStatusDisplay } from "../lib/rich-status.js";
import { initToolCallLogger } from "../lib/tool-call-logger.js";
import {
  extractCategoryFromIntent,
  formatPatternsAsMemory,
  recallPatterns,
  recordPattern,
} from "../lib/session-learning.js";
import { checkContextHealth, displayContextHealthWarning } from "../lib/context-health.js";
import {
  isInteractive,
  renderErrorPanel,
  renderPiBubble,
  renderPiTurnHeader,
  renderRecapCard,
  renderTurnSeparator,
  renderUserTurnHeader,
  shouldUseColor,
  shouldUseUnicode,
  trackSpinner,
  type RecapSummary,
  type TurnMeta,
} from "../lib/ui/chat-ui.js";
import {
  parseUserReply,
  renderSlashHelp,
  type SlashCommand,
} from "../lib/ui/slash-commands.js";
import {
  defaultVerbosity,
  greetingLine,
  personaStyle,
  reframeHeading,
  showPersonaTips,
} from "../lib/ui/persona-style.js";
import { getPersona, type PiPersona } from "../lib/config.js";

/** V1 = legacy rendering, V2 = new chat UI. Default: V2 unless PI_CLI_UI=v1. */
function useV2Ui(): boolean {
  const flag = (process.env.PI_CLI_UI ?? "").trim().toLowerCase();
  if (flag === "v1" || flag === "legacy") return false;
  return true;
}

const TARGET_EXCERPT_MAX_FILES = 10;
const TARGET_EXCERPT_MAX_BYTES = 32_000;
const PI_PLAN_FILE = ".pi-plan.md";

export type ResonateSessionMode = "explore" | "challenge" | "decision";

export type ResonateCliOpts = PreFlightGlobalOpts & {
  noSave?: boolean;
  /** @deprecated use --deep */
  withExcerpts?: boolean;
  mode?: ResonateSessionMode;
  /** Staged + working tree diff summary for server */
  staged?: boolean;
  /** Deeper repo signals (histogram excerpts + server AST path) */
  deep?: boolean;
  /** Resume from a prior .pi/resonance/*.md */
  resume?: string;
  /** After save, print a ready-to-run `pi routine` line */
  export?: boolean;
  /** JSON file from `pi validate --json` */
  violationsFile?: string;
  /** Use Mastra workflow-backed Socratic Loop (requires PI_CLI_USE_WORKFLOWS) */
  workflow?: boolean;
  /** Generate .pi-plan.md after consensus */
  plan?: boolean;
  /** Resume a prior omnirouter session (local transcript) */
  resumeSessionId?: string;
  /** Invoked via `pi "<nl>"` omnirouter */
  fromOmniRouter?: boolean;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

export type ClaimEvidence =
  | "graph"
  | "system_style"
  | "ast"
  | "diff"
  | "constitution"
  | "validation"
  | "memory"
  | "inference";

export type ResonateLastTurn = {
  message: string;
  tradeoffs: string[];
  risks: string[];
  invariants: string[];
  open_questions: string[];
  suggested_alternatives: string[];
  recommended_approach: { label: "A" | "B" | "none"; rationale: string };
  exit_criteria: string[];
  claims: Array<{
    claim: string;
    source: string;
    evidence_type?: ClaimEvidence;
    confidence?: number;
  }>;
  conflict_type: "hard_constraint" | "pattern_divergence" | "preference" | "none";
  files_likely_touched?: string[];
  grounding_quality: {
    graph_available: boolean;
    style_available: boolean;
    excerpts_count: number;
    constitution_loaded: boolean;
  };
  is_ready: boolean;
  thread_id: string;
  session_status: "question" | "building" | "resolved";
  next_action: "reply" | "approve" | "execute" | "done";
};

type ValidateJson = {
  local?: Array<{ rule: string; message: string; file: string; line: number }>;
  semantic?: Array<{ rule: string; message: string }>;
};

function flattenValidateViolations(j: ValidateJson): string[] {
  const v: string[] = [];
  for (const x of j.local ?? []) {
    v.push(`[${x.rule}] ${x.file}:${x.line} — ${x.message}`);
  }
  for (const x of j.semantic ?? []) {
    v.push(`[semantic:${x.rule}] ${x.message}`);
  }
  return v;
}

function groundingWarning(gq: ResonateLastTurn["grounding_quality"]): string | null {
  if (!gq.graph_available && !gq.style_available) {
    return "Low grounding: no import graph and no system-style. File-impact claims are unverified. Run `pi learn` and `pi learn --with-graph`.";
  }
  if (!gq.graph_available) {
    return "Limited grounding: no import graph in Pi storage. Dependents/impact lines are weaker until `pi learn --with-graph`.";
  }
  if (!gq.style_available) {
    return "Limited grounding: system-style missing. Run `pi learn` for convention lock-in.";
  }
  return null;
}

/**
 * Build the structured detail block (risks/tradeoffs/claims/etc) that follows
 * Pi's main message. Used by both v1 and v2 rendering — v2 wraps it inside
 * the chat bubble; v1 prints it below the header.
 */
function buildDetailSections(
  data: ResonateLastTurn,
  persona: PiPersona,
  opts: { verbosity: "full" | "compact" }
): string {
  const lines: string[] = [];
  const c = shouldUseColor();
  const bold = (s: string) => (c ? chalk.bold(s) : s);
  const dim = (s: string) => (c ? chalk.dim(s) : s);

  const gw = groundingWarning(data.grounding_quality);
  if (gw) {
    lines.push((c ? chalk.yellow("⚠  ") : "! ") + dim(gw), "");
  }

  if (data.conflict_type === "hard_constraint") {
    lines.push(c ? chalk.red("Conflict: hard constraint (constitution / invariant)") : "Conflict: hard constraint", "");
  } else if (data.conflict_type === "pattern_divergence") {
    lines.push(c ? chalk.magenta("Conflict: pattern divergence vs existing code") : "Conflict: pattern divergence", "");
  } else if (data.conflict_type === "preference") {
    lines.push(c ? chalk.blue("Note: product / preference tradeoff") : "Note: product / preference tradeoff", "");
  }

  const bullet = shouldUseUnicode() ? "•" : "-";
  const pushSection = (heading: string, items: string[]) => {
    if (!items.length) return;
    const label = reframeHeading(persona, heading);
    lines.push(bold(label), ...items.map((t) => `  ${bullet} ${t}`), "");
  };

  // In compact mode (expert persona, or /quiet) only show highest-signal
  // sections: risks + recommended approach.
  if (opts.verbosity === "full") {
    pushSection("Risks", data.risks);
    pushSection("Tradeoffs", data.tradeoffs);
    pushSection("Invariants", data.invariants);
    pushSection("Open questions", data.open_questions);
    pushSection("Alternatives", data.suggested_alternatives);
  } else {
    pushSection("Risks", data.risks.slice(0, 3));
  }

  if (data.recommended_approach.label !== "none") {
    lines.push(
      bold(`Recommended: ${data.recommended_approach.label}`),
      dim(data.recommended_approach.rationale),
      ""
    );
  }

  if (opts.verbosity === "full") {
    pushSection("Exit criteria", data.exit_criteria);

    if (data.claims.length) {
      lines.push(bold("Claims (cited)"));
      for (const cm of data.claims.slice(0, 12)) {
        const ev = cm.evidence_type ? (c ? chalk.cyan(` [${cm.evidence_type}]`) : ` [${cm.evidence_type}]`) : "";
        const conf =
          typeof cm.confidence === "number" ? dim(` conf=${cm.confidence.toFixed(2)}`) : "";
        lines.push(`  ${bullet} ${cm.claim} ${dim(`(${cm.source})`)}${ev}${conf}`);
      }
      lines.push("");
    }

    if (data.files_likely_touched?.length) {
      pushSection("Files likely touched", data.files_likely_touched);
    }
  }

  if (opts.verbosity === "full") {
    lines.push(
      dim(
        `Grounding: graph=${data.grounding_quality.graph_available} style=${data.grounding_quality.style_available} excerpts=${data.grounding_quality.excerpts_count} constitution=${data.grounding_quality.constitution_loaded}`
      )
    );
  }

  if (data.is_ready) {
    lines.push(
      "",
      c
        ? chalk.green("Architecture looks agreed — type ") + chalk.bold("done") + chalk.green(" or ") + chalk.bold("/done") + chalk.green(" to save.")
        : "Architecture looks agreed — type `done` or `/done` to save."
    );
  }

  // Persona-aware tips footer (newbie/designer/pm only).
  if (showPersonaTips(persona) && data.is_ready === false) {
    lines.push(
      "",
      dim(
        persona === "pm"
          ? "Tip: reply with user-impact concerns, or `/done` to capture acceptance criteria."
          : persona === "designer"
          ? "Tip: reply with component/token concerns, or `/done` to save."
          : "Tip: reply with your thoughts, `/explain` for more detail, or `/done` to save."
      )
    );
  }

  return lines.join("\n").trimEnd();
}

function formatAssistantBlock(data: ResonateLastTurn): string {
  const lines: string[] = [data.message.trim(), ""];
  const gw = groundingWarning(data.grounding_quality);
  if (gw) {
    lines.push(chalk.yellow("⚠  ") + chalk.dim(gw), "");
  }
  if (data.conflict_type === "hard_constraint") {
    lines.push(chalk.red("Conflict: hard constraint (constitution / invariant)"), "");
  } else if (data.conflict_type === "pattern_divergence") {
    lines.push(chalk.magenta("Conflict: pattern divergence vs existing code"), "");
  } else if (data.conflict_type === "preference") {
    lines.push(chalk.blue("Note: product / preference tradeoff"), "");
  }
  if (data.risks.length) {
    lines.push(chalk.bold("Risks"), ...data.risks.map((t) => `  • ${t}`), "");
  }
  if (data.tradeoffs.length) {
    lines.push(chalk.bold("Tradeoffs"), ...data.tradeoffs.map((t) => `  • ${t}`), "");
  }
  if (data.invariants.length) {
    lines.push(chalk.bold("Invariants"), ...data.invariants.map((t) => `  • ${t}`), "");
  }
  if (data.open_questions.length) {
    lines.push(chalk.bold("Open questions"), ...data.open_questions.map((t) => `  • ${t}`), "");
  }
  if (data.suggested_alternatives.length) {
    lines.push(chalk.bold("Alternatives"), ...data.suggested_alternatives.map((t) => `  • ${t}`), "");
  }
  if (data.recommended_approach.label !== "none") {
    lines.push(
      chalk.bold(`Recommended: ${data.recommended_approach.label}`),
      chalk.dim(data.recommended_approach.rationale),
      ""
    );
  }
  if (data.exit_criteria.length) {
    lines.push(chalk.bold("Exit criteria"), ...data.exit_criteria.map((t) => `  • ${t}`), "");
  }
  if (data.claims.length) {
    lines.push(chalk.bold("Claims (cited)"));
    for (const c of data.claims.slice(0, 16)) {
      const ev = c.evidence_type ? chalk.cyan(` [${c.evidence_type}]`) : "";
      const conf =
        typeof c.confidence === "number" ? chalk.dim(` conf=${c.confidence.toFixed(2)}`) : "";
      lines.push(`  • ${c.claim} ${chalk.dim(`(${c.source})`)}${ev}${conf}`);
    }
    lines.push("");
  }
  if (data.files_likely_touched?.length) {
    lines.push(
      chalk.bold("Files likely touched"),
      ...data.files_likely_touched.map((t) => `  • ${t}`),
      ""
    );
  }
  lines.push(
    chalk.dim(
      `Grounding: graph=${data.grounding_quality.graph_available} style=${data.grounding_quality.style_available} excerpts=${data.grounding_quality.excerpts_count} constitution=${data.grounding_quality.constitution_loaded}`
    ),
    ""
  );
  if (data.is_ready) {
    lines.push(
      chalk.green("Architecture looks agreed — you can type ") + chalk.bold("done") + chalk.green(" to save.")
    );
  }
  return lines.join("\n");
}

function parseSimpleFrontmatter(fm: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fm.split("\n")) {
    const m = /^(intent|thread_id|branch|mode|depth):\s+(.+)$/.exec(line.trim());
    if (m) {
      let v = m[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1).replace(/\\"/g, '"');
      }
      out[m[1]] = v;
    }
  }
  return out;
}

function extractMarkdownSection(md: string, title: string): string {
  const needle = `## ${title}`;
  const idx = md.indexOf(needle);
  if (idx < 0) return "";
  const rest = md.slice(idx + needle.length);
  const next = rest.search(/^## /m);
  return (next >= 0 ? rest.slice(0, next) : rest).trim();
}

function parseTranscript(section: string): ChatMsg[] {
  const messages: ChatMsg[] = [];
  const re = /### (You|Pi)\s*\n\n([\s\S]*?)(?=### (?:You|Pi)\s*\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    const role = m[1] === "You" ? "user" : "assistant";
    messages.push({ role, content: m[2].trim() });
  }
  return messages;
}

export async function parseResonanceSessionFile(
  cwd: string,
  fileArg: string
): Promise<{ intent?: string; threadId?: string; branch?: string; mode?: string; messages: ChatMsg[] }> {
  const abs = path.isAbsolute(fileArg) ? fileArg : path.join(cwd, fileArg);
  const raw = await fs.readFile(abs, "utf8");
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = fmMatch ? parseSimpleFrontmatter(fmMatch[1]) : {};
  const transcriptBody = extractMarkdownSection(raw, "Transcript");
  const messages = parseTranscript(transcriptBody);
  return {
    intent: fm.intent,
    threadId: fm.thread_id,
    branch: fm.branch,
    mode: fm.mode,
    messages,
  };
}

async function buildGitDiffSummary(cwd: string): Promise<string> {
  try {
    const files = await getPendingChanges(cwd);
    const hunks = await getChangedHunksLegacy(cwd, "staged");
    const parts: string[] = [];
    parts.push(`Changed files (${files.length}): ${files.slice(0, 60).join(", ")}`);
    for (const fh of hunks.slice(0, 20)) {
      parts.push(`\n## ${fh.file}`);
      for (const h of fh.hunks.slice(0, 4)) {
        parts.push(h.content.slice(0, 2500));
      }
    }
    return parts.join("\n").slice(0, 80_000);
  } catch {
    return "(could not read git diff)";
  }
}

async function mergeTargetedExcerpts(
  cwd: string,
  base: RoutineContextPayload,
  files: string[] | undefined
): Promise<RoutineContextPayload> {
  if (!files?.length) return base;
  const excerpts = [...(base.file_excerpts ?? [])];
  const seen = new Set(excerpts.map((e) => e.path.replace(/\\/g, "/")));
  let total = excerpts.reduce((s, e) => s + e.excerpt.length, 0);

  for (const rel of files) {
    if (excerpts.length >= TARGET_EXCERPT_MAX_FILES) break;
    const norm = rel.replace(/\\/g, "/").replace(/^\.\//, "");
    if (seen.has(norm)) continue;
    try {
      const abs = path.join(cwd, norm);
      const raw = await fs.readFile(abs, "utf8");
      const { redacted } = redactSource(raw);
      const chunk = redacted.slice(0, 8000);
      if (total + chunk.length > TARGET_EXCERPT_MAX_BYTES) break;
      excerpts.push({ path: norm, excerpt: chunk });
      seen.add(norm);
      total += chunk.length;
    } catch {
      /* missing or binary */
    }
  }

  return { ...base, file_excerpts: excerpts };
}

async function writeResonanceFile(
  cwd: string,
  params: {
    intent: string;
    branch: string;
    mode: ResonateSessionMode;
    depth: "fast" | "deep";
    messages: ChatMsg[];
    last: ResonateLastTurn;
  }
): Promise<string> {
  const slug = slugFromIntentLocal(params.intent);
  const day = new Date().toISOString().slice(0, 10);
  const rel = path.join(PI_RESONANCE_DIR, `${slug}-${day}.md`);
  const abs = path.join(cwd, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });

  const yamlEscape = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;

  const fm = [
    "---",
    `intent: ${yamlEscape(params.intent)}`,
    `branch: ${yamlEscape(params.branch)}`,
    `mode: ${yamlEscape(params.mode)}`,
    `depth: ${yamlEscape(params.depth)}`,
    `created_at: ${yamlEscape(new Date().toISOString())}`,
    `thread_id: ${yamlEscape(params.last.thread_id)}`,
    `is_ready: ${params.last.is_ready}`,
    `conflict_type: ${params.last.conflict_type}`,
    "tradeoffs:",
    ...params.last.tradeoffs.map((t) => `  - ${yamlEscape(t)}`),
    "risks:",
    ...params.last.risks.map((t) => `  - ${yamlEscape(t)}`),
    "invariants:",
    ...params.last.invariants.map((t) => `  - ${yamlEscape(t)}`),
    "open_questions:",
    ...params.last.open_questions.map((t) => `  - ${yamlEscape(t)}`),
    "suggested_alternatives:",
    ...params.last.suggested_alternatives.map((t) => `  - ${yamlEscape(t)}`),
    "exit_criteria:",
    ...params.last.exit_criteria.map((t) => `  - ${yamlEscape(t)}`),
    `recommended_approach: ${yamlEscape(JSON.stringify(params.last.recommended_approach))}`,
    ...(params.last.files_likely_touched?.length
      ? ["files_likely_touched:", ...params.last.files_likely_touched.map((t) => `  - ${yamlEscape(t)}`)]
      : ["files_likely_touched: []"]),
    "---",
  ].join("\n");

  const transcript = params.messages
    .map((m) => `### ${m.role === "user" ? "You" : "Pi"}\n\n${m.content.trim()}\n`)
    .join("\n");

  const decisions = [
    "## Decisions",
    "",
    "### Invariants",
    ...params.last.invariants.map((x) => `- ${x}`),
    "",
    "### Recommended approach",
    `- ${params.last.recommended_approach.label}: ${params.last.recommended_approach.rationale}`,
    "",
    "### Exit criteria",
    ...params.last.exit_criteria.map((x) => `- ${x}`),
    "",
  ].join("\n");

  const claimsSec =
    params.last.claims.length > 0 ?
      [
        "## Claims (cited)",
        "",
        ...params.last.claims.map((c) => {
          const ev = c.evidence_type ? ` _[${c.evidence_type}]_` : "";
          const cf = typeof c.confidence === "number" ? ` (${c.confidence.toFixed(2)})` : "";
          return `- **${c.claim}** _(${c.source})_${ev}${cf}`;
        }),
      ].join("\n")
    : "";

  const openSec =
    params.last.open_questions.length > 0 ?
      ["## Open questions", "", ...params.last.open_questions.map((x) => `- ${x}`)].join("\n")
    : "";

  const hardSec =
    params.last.conflict_type === "hard_constraint" ?
      ["## Hard constraints", "", "This design conflicts with non-negotiable rules — resolve before implementation."].join(
        "\n"
      )
    : "";

  const body = `${fm}

# Resonance

Use this document as the single source of truth before running \`pi routine\` or pasting into Cursor.

${decisions}

${claimsSec}

${openSec}

${hardSec}

## Transcript

${transcript}

## Next step

- **Invariants / exit criteria** are listed under Decisions — paste into your coding agent or use as acceptance checks.
- Run \`pi routine "${params.intent.replace(/"/g, '\\"')}"\` (add \`--with-excerpts\` if you need deeper repo grounding).
- Or paste this file into your coding agent as the build spec.
`;

  await fs.writeFile(abs, body, "utf8");
  return rel;
}

function normalizeClaims(
  raw: Array<{
    claim: string;
    source: string;
    evidence_type?: string;
    confidence?: number;
  }>
): ResonateLastTurn["claims"] {
  const allowed = new Set<ClaimEvidence>([
    "graph",
    "system_style",
    "ast",
    "diff",
    "constitution",
    "validation",
    "memory",
    "inference",
  ]);
  return raw.map((c) => {
    const ev = c.evidence_type && allowed.has(c.evidence_type as ClaimEvidence) ? (c.evidence_type as ClaimEvidence) : undefined;
    const conf =
      typeof c.confidence === "number" && Number.isFinite(c.confidence) ? Math.min(1, Math.max(0, c.confidence)) : undefined;
    return {
      claim: c.claim,
      source: c.source,
      ...(ev ? { evidence_type: ev } : {}),
      ...(conf !== undefined ? { confidence: conf } : {}),
    };
  });
}

async function writeHandoffFile(
  cwd: string,
  params: {
    intent: string;
    branch: string;
    mode: ResonateSessionMode;
    depth: "fast" | "deep";
    last: ResonateLastTurn;
    resonanceRel: string;
  }
): Promise<string> {
  const abs = path.join(cwd, PI_HANDOFF_FILE);
  await fs.mkdir(path.dirname(abs), { recursive: true });

  const forbidden =
    params.last.conflict_type === "hard_constraint" ?
      [
        "Do not ship changes that violate `.pi/constitution.md` or listed invariants.",
        "Resolve hard constraints before writing production code.",
      ]
    : [
        "Do not expand scope beyond the agreed intent without another `pi resonate` pass.",
      ];

  const body = `# Pi handoff — ${params.intent}

**Branch:** \`${params.branch}\` · **Mode:** ${params.mode} · **Depth:** ${params.depth}  
**Full record:** \`${params.resonanceRel}\`

## Copy into Cursor / Claude / Windsurf

You are implementing the following. Meet **Acceptance** and **Invariants**. Do not violate **Out of scope**.

**Intent:** ${params.intent}

**Pi summary:**  
${params.last.message.trim().slice(0, 1200)}${params.last.message.length > 1200 ? "…" : ""}

## Acceptance (exit criteria)

${params.last.exit_criteria.length ? params.last.exit_criteria.map((x) => `- ${x}`).join("\n") : "- (define in resonance session)"}

## Invariants (must hold)

${params.last.invariants.length ? params.last.invariants.map((x) => `- ${x}`).join("\n") : "- (none listed)"}

## Files likely in scope

${(params.last.files_likely_touched ?? []).length ? (params.last.files_likely_touched ?? []).map((f) => `- \`${f}\``).join("\n") : "- (see resonance transcript)"}

## Risks to address

${params.last.risks.length ? params.last.risks.map((r) => `- ${r}`).join("\n") : "- (none listed)"}

## Claims (with evidence)

${params.last.claims.length ? params.last.claims.map((c) => {
    const ev = c.evidence_type ? ` — *${c.evidence_type}*` : "";
    const cf = typeof c.confidence === "number" ? ` (${c.confidence.toFixed(2)})` : "";
    return `- ${c.claim} (${c.source})${ev}${cf}`;
  }).join("\n") : "- (none)"}

## Out of scope / forbidden

${forbidden.map((f) => `- ${f}`).join("\n")}

## Suggested commands

- \`pi validate\` — before merge  
- \`pi routine "${params.intent.replace(/"/g, '\\"')}"\` — generate a build spec if needed  
`;

  await fs.writeFile(abs, body, "utf8");
  return PI_HANDOFF_FILE;
}

// ---------------------------------------------------------------------------
// Shadow Plan writer (.pi-plan.md)
// ---------------------------------------------------------------------------

async function writeShadowPlan(cwd: string, markdown: string): Promise<string> {
  const abs = path.join(cwd, PI_PLAN_FILE);
  await fs.writeFile(abs, markdown, "utf8");
  return PI_PLAN_FILE;
}

function buildLocalShadowPlan(intent: string, last: ResonateLastTurn): string {
  const day = new Date().toISOString().slice(0, 10);
  let stepNum = 0;
  const steps: string[] = [];

  // Prerequisites from suggested alternatives / open questions
  if (last.open_questions.length > 0) {
    stepNum++;
    steps.push(`## Step ${stepNum}: Resolve Open Questions
- **Action:** Answer or defer these questions before building:
${last.open_questions.map((q) => `  - ${q}`).join("\n")}
- **Command:** \`pi execute ${stepNum}\``);
  }

  if (last.suggested_alternatives.length > 0) {
    stepNum++;
    steps.push(`## Step ${stepNum}: Core Implementation
- **Action:** Implement using the recommended approach.
- **Alternatives considered:** ${last.suggested_alternatives.join("; ")}
- **Command:** \`pi execute ${stepNum}\``);
  } else {
    stepNum++;
    steps.push(`## Step ${stepNum}: Core Implementation
- **Action:** Build the feature as agreed.
- **Command:** \`pi execute ${stepNum}\``);
  }

  if (last.risks.length > 0) {
    stepNum++;
    steps.push(`## Step ${stepNum}: Risk Mitigation
- **Action:** Address known risks:
${last.risks.map((r) => `  - ${r}`).join("\n")}
- **Command:** \`pi execute ${stepNum}\``);
  }

  stepNum++;
  steps.push(`## Step ${stepNum}: Validation
- **Action:** Run \`pi validate\` and verify exit criteria.
- **Command:** \`pi execute ${stepNum}\``);

  return `# Architectural Plan: ${intent}
**Status:** Pending Execution
**Date:** ${day}
**Consensus:** ${last.is_ready ? "Yes" : "Pending"}

## Context
${last.message.slice(0, 2000)}

## Invariants
${last.invariants.map((i) => `- ${i}`).join("\n") || "- (none)"}

## Exit Criteria
${last.exit_criteria.map((e) => `- ${e}`).join("\n") || "- (to be determined)"}

${steps.join("\n\n")}

## Files Likely Touched
${(last.files_likely_touched ?? []).map((f) => `- ${f}`).join("\n") || "- (to be determined)"}

## Claims (cited)
${last.claims.map((c) => {
    const ev = c.evidence_type ? ` _[${c.evidence_type}]_` : "";
    const cf = typeof c.confidence === "number" ? ` (${c.confidence.toFixed(2)})` : "";
    return `- **${c.claim}** _(${c.source})_${ev}${cf}`;
  }).join("\n") || "- (none)"}
`;
}

// ---------------------------------------------------------------------------
// Workflow-mode Socratic UI helpers
// ---------------------------------------------------------------------------

type SocraticChallenge = {
  understanding: string;
  missing_prerequisites: string[];
  architectural_traps: string[];
  alternative_paths: Array<{ id: string; title: string; description: string; tradeoffs: string }>;
  probing_question: string;
  risks: string[];
  invariants: string[];
  claims: Array<{ claim: string; source: string; evidence_type?: ClaimEvidence; confidence?: number }>;
  conflict_type: string;
  files_likely_touched?: string[];
  is_ready: boolean;
};

type AstInsights = {
  blast_radius_summaries: string[];
  missing_prerequisites: string[];
  prerequisite_severity: string;
  boundary_violations: string[];
};

function renderSocraticChallenge(challenge: SocraticChallenge, astInsights?: AstInsights): void {
  console.log("");
  console.log(chalk.bold.cyan("Pi (Architect)"));
  console.log(chalk.white(challenge.understanding));
  console.log("");

  // AST-verified insights
  if (astInsights) {
    if (astInsights.missing_prerequisites.length > 0) {
      clack.note(
        astInsights.missing_prerequisites.map((p, i) => `${i + 1}. ${p}`).join("\n"),
        `Missing Prerequisites (${astInsights.prerequisite_severity})`
      );
    }
    if (astInsights.boundary_violations.length > 0) {
      for (const v of astInsights.boundary_violations) {
        clack.log.warn(chalk.red(v));
      }
    }
    if (astInsights.blast_radius_summaries.length > 0) {
      clack.note(
        astInsights.blast_radius_summaries.join("\n"),
        "Blast Radius (ts-morph verified)"
      );
    }
  }

  // Challenge-level insights
  if (challenge.missing_prerequisites.length > 0 && (!astInsights || astInsights.missing_prerequisites.length === 0)) {
    clack.note(
      challenge.missing_prerequisites.map((p, i) => `${i + 1}. ${p}`).join("\n"),
      "Missing Prerequisites"
    );
  }

  if (challenge.architectural_traps.length > 0) {
    for (const trap of challenge.architectural_traps) {
      clack.log.warn(chalk.yellow(trap));
    }
  }

  if (challenge.conflict_type === "hard_constraint") {
    clack.log.error(chalk.red("HARD CONSTRAINT: This conflicts with non-negotiable rules."));
  } else if (challenge.conflict_type === "pattern_divergence") {
    clack.log.warn(chalk.magenta("Pattern divergence from existing codebase conventions."));
  }

  if (challenge.risks.length > 0) {
    console.log(chalk.bold("\nRisks"));
    for (const r of challenge.risks) {
      console.log(chalk.red(`  ! ${r}`));
    }
  }

  if (challenge.invariants.length > 0) {
    console.log(chalk.bold("\nInvariants"));
    for (const inv of challenge.invariants) {
      console.log(chalk.green(`  > ${inv}`));
    }
  }

  if (challenge.claims.length > 0) {
    console.log(chalk.bold("\nClaims (cited)"));
    for (const c of challenge.claims.slice(0, 12)) {
      console.log(`  * ${c.claim} ${chalk.dim(`(${c.source})`)}`);
    }
  }

  if (challenge.files_likely_touched?.length) {
    console.log(chalk.bold("\nFiles likely touched"));
    for (const f of challenge.files_likely_touched.slice(0, 15)) {
      console.log(`  ${chalk.dim(f)}`);
    }
  }

  if (challenge.is_ready) {
    console.log("");
    clack.log.success(chalk.green("Architecture looks agreed. Type \"done\" to finalize or select a path to continue."));
  }
  console.log("");
}

async function promptSocraticResponse(
  challenge: SocraticChallenge
): Promise<{ action: "continue" | "done" | "go_back"; selected_path?: string; reply?: string } | null> {
  const hasAlternatives = challenge.alternative_paths.length > 0;

  if (hasAlternatives) {
    const options = [
      ...challenge.alternative_paths.map((p) => ({
        value: `path:${p.id}`,
        label: p.title,
        hint: p.tradeoffs,
      })),
      { value: "debate", label: "Debate this further", hint: "Type your own reply" },
      { value: "done", label: "Consensus reached — finalize", hint: "Save and generate plan" },
      { value: "go_back", label: "Go back to start", hint: "Re-analyze from scratch" },
    ];

    const choice = await clack.select({
      message: challenge.probing_question || "How should we proceed?",
      options,
    });

    if (isCancel(choice)) return null;

    const val = choice as string;
    if (val === "done") return { action: "done" };
    if (val === "go_back") return { action: "go_back" };
    if (val === "debate") {
      const reply = await text({
        message: chalk.gray("Your thoughts..."),
        placeholder: "I think we should...",
      });
      if (isCancel(reply)) return null;
      return { action: "continue", reply: reply.trim() };
    }
    if (val.startsWith("path:")) {
      const pathId = val.slice(5);
      const selected = challenge.alternative_paths.find((p) => p.id === pathId);
      const reply = await text({
        message: chalk.gray(`You chose: ${selected?.title ?? pathId}. Any additional thoughts?`),
        placeholder: "(press Enter to continue with this choice)",
      });
      if (isCancel(reply)) return null;
      return { action: "continue", selected_path: pathId, reply: reply.trim() || undefined };
    }
  }

  const reply = await text({
    message: challenge.probing_question || chalk.gray('Reply, or type "done" to finalize'),
    placeholder: "Your thoughts...",
  });

  if (isCancel(reply)) return null;
  const trimmed = reply.trim();
  if (trimmed.toLowerCase() === "done" || trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
    return { action: "done" };
  }
  if (trimmed.toLowerCase() === "go back" || trimmed.toLowerCase() === "back" || trimmed.toLowerCase() === "restart") {
    return { action: "go_back" };
  }
  return { action: "continue", reply: trimmed };
}

// ---------------------------------------------------------------------------
// Workflow-mode resonate
// ---------------------------------------------------------------------------

async function runResonateWorkflow(
  cwd: string,
  intent: string,
  opts: ResonateCliOpts & {
    branch_name: string;
    developer_id?: string;
    system_style?: Record<string, unknown>;
    constitution?: string;
    git_diff_summary?: string;
    routine_context: RoutineContextPayload;
    taskTracker?: CommandTaskTracker;
  }
): Promise<void> {
  const client = new PiApiClient();
  const mode: ResonateSessionMode = opts.mode ?? "challenge";
  const deep = Boolean(opts.deep || opts.withExcerpts);

  intro(
    chalk.cyan(`pi resonate — ${mode} mode`) +
    chalk.dim(" (workflow)") +
    (deep ? chalk.dim(" (deep)") : chalk.dim(" (fast)"))
  );

  const s = clack.spinner();
  s.start("Initializing Socratic Loop workflow...");

  let result: Awaited<ReturnType<typeof client.resonateWorkflowStart>>;
  try {
    result = await client.resonateWorkflowStart({
      intent,
      messages: [{ role: "user", content: intent }],
      branch_name: opts.branch_name,
      developer_id: opts.developer_id,
      system_style: opts.system_style,
      routine_context: opts.routine_context as Record<string, unknown>,
      mode,
      depth: deep ? "deep" : "fast",
      constitution: opts.constitution,
      git_diff_summary: opts.git_diff_summary,
    });
  } catch (e) {
    s.stop("Workflow start failed.");
    console.error(chalk.red(e instanceof Error ? e.message : "Workflow failed."));
    console.log(chalk.dim("Falling back to legacy resonate mode..."));
    return;
  }

  s.stop("Workflow initialized.");

  if (!result.run_id) {
    console.log(chalk.yellow("Workflow did not return a run_id — the server may have fallen back to legacy mode."));
    return;
  }

  const runId = result.run_id;
  let currentStatus = result.status ?? "running";

  // Socratic debate loop
  while (currentStatus === "suspended") {
    const suspendData = result.suspend_payload as Record<string, unknown> | undefined;
    const challenge = (suspendData?.challenge ?? suspendData) as SocraticChallenge | undefined;
    const astInsights = suspendData?.ast_insights as AstInsights | undefined;

    if (!challenge) {
      console.log(chalk.yellow("Workflow suspended but no challenge payload. Polling..."));
      const polled = await client.workflowPoll({ workflow_key: "cliResonateWorkflow", run_id: runId });
      currentStatus = polled.status;
      if (polled.suspend_payload) {
        const sp = polled.suspend_payload as Record<string, unknown>;
        Object.assign(result, { suspend_payload: sp, status: polled.status });
      }
      continue;
    }

    renderSocraticChallenge(challenge, astInsights);

    const userResponse = await promptSocraticResponse(challenge);
    if (!userResponse) {
      outro(chalk.gray("Cancelled."));
      return;
    }

    const s2 = clack.spinner();
    s2.start(
      userResponse.action === "done" ? "Committing decision to memory..."
      : userResponse.action === "go_back" ? "Reverting to initial analysis..."
      : "Processing your response..."
    );

    try {
      const resumed = await client.workflowResume({
        workflow_key: "cliResonateWorkflow",
        run_id: runId,
        step_id: "socratic-debate",
        resume_data: userResponse,
      });

      s2.stop("Response processed.");

      const wfResult = resumed.workflow_result as Record<string, unknown> | undefined;
      currentStatus = (wfResult?.status as string) ?? "completed";

      if (currentStatus === "suspended") {
        Object.assign(result, {
          suspend_payload: wfResult?.suspend_payload ?? wfResult?.suspendedSteps ?? wfResult,
          status: "suspended",
        });
      } else if (wfResult?.shadow_plan_markdown) {
        // Workflow completed — write shadow plan
        const planMd = wfResult.shadow_plan_markdown as string;
        if (opts.plan || opts.plan === undefined) {
          const planRel = await writeShadowPlan(cwd, planMd);
          console.log(chalk.green("✓"), `Shadow plan written: ${planRel}`);
          console.log(chalk.dim("→ Execute steps with: pi execute 1"));
        }
        currentStatus = "completed";
      } else {
        currentStatus = "completed";
      }
    } catch (e) {
      s2.stop("Resume failed.");
      console.error(chalk.red(e instanceof Error ? e.message : "Resume failed."));
      currentStatus = "failed";
    }
  }

  if (currentStatus === "completed") {
    opts.taskTracker?.completeStep("session");
    opts.taskTracker?.complete();
    outro(chalk.green("Resonance complete (workflow mode)."));
  } else if (currentStatus === "failed") {
    opts.taskTracker?.fail(new Error("Resonate workflow failed"));
    outro(chalk.red("Workflow ended with errors."));
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runResonate(cwd: string, intentArg: string, opts?: ResonateCliOpts): Promise<void> {
  const preflightOpts = {
    noAuto: opts?.noAuto,
    skipLearn: opts?.skipLearn,
    skipSync: opts?.skipSync,
    requireLearn: opts?.requireLearn,
  };
  await ensurePiDir(cwd, preflightOpts);
  await ensureTeamSyncIfNeeded(cwd, preflightOpts);
  await ensureSystemStyleJson(cwd, preflightOpts);
  
  // Initialize tool call logging for visibility
  initToolCallLogger(!opts?.fromOmniRouter);
  
  // Create rich status display
  const status = createStatusDisplay({ verbose: Boolean(opts?.deep) });
  
  // Check context health before starting (only if not auto-learned above)
  if (!opts?.resumeSessionId && !opts?.resume && !opts?.noAuto) {
    const health = await checkContextHealth(cwd);
    if (health.isStale && health.reasons.length > 0) {
      displayContextHealthWarning(health);
    }
  }
  
  const client = new PiApiClient();
  const mode: ResonateSessionMode = opts?.mode ?? "challenge";
  const deep = Boolean(opts?.deep || opts?.withExcerpts);

  let intent = intentArg.trim();
  let messages: ChatMsg[] = [{ role: "user", content: intent }];

  if (opts?.resume) {
    const parsed = await parseResonanceSessionFile(cwd, opts.resume);
    if (parsed.intent && !intent) intent = parsed.intent;
    if (parsed.messages.length) {
      messages = parsed.messages;
      console.log(chalk.dim(`Resuming session (${messages.length} messages) from ${opts.resume}`));
    } else if (intent) {
      messages = [{ role: "user", content: `[Resuming session]\n\n${intent}` }];
    } else {
      console.error(chalk.red("Could not resume: missing intent and empty transcript."));
      process.exitCode = 1;
      return;
    }
  } else if (opts?.resumeSessionId) {
    const sess = loadSessions().find((s) => s.session_id === opts.resumeSessionId);
    if (sess) {
      intent = sess.intent_summary;
      messages = [...sess.messages, { role: "user", content: intentArg.trim() }];
      console.log(
        chalk.dim(`Resuming omnirouter session (${messages.length} messages) — ${sess.session_id.slice(0, 8)}…`)
      );
    } else {
      console.log(chalk.yellow("Session id not found locally; starting a new thread."));
      messages = [{ role: "user", content: intentArg.trim() }];
    }
  }

  if (!intent) {
    console.error(chalk.red("Missing intent."));
    process.exitCode = 1;
    return;
  }

  let system_style: Record<string, unknown> | undefined;
  try {
    const raw = await fs.readFile(path.join(cwd, SYSTEM_STYLE_FILE), "utf8");
    system_style = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    system_style = undefined;
  }

  let constitution: string | undefined;
  try {
    constitution = await fs.readFile(path.join(cwd, PI_CONSTITUTION_FILE), "utf8");
  } catch {
    constitution = undefined;
  }

  let validate_context: { violations: string[]; routine_slug?: string } | undefined;
  
  // Auto-detect last validate result if no explicit violations file provided
  const violationsFilePath = opts?.violationsFile 
    ? (path.isAbsolute(opts.violationsFile) ? opts.violationsFile : path.join(cwd, opts.violationsFile))
    : path.join(cwd, PI_LAST_VALIDATE_RESULT);
  
  try {
    const raw = await fs.readFile(violationsFilePath, "utf8");
    const j = JSON.parse(raw) as ValidateJson;
    validate_context = { violations: flattenValidateViolations(j) };
    
    // If we auto-detected the last result, let user know
    if (!opts?.violationsFile) {
      console.log(chalk.dim(`◐ Auto-loaded validate results from ${PI_LAST_VALIDATE_RESULT}`));
    }
  } catch (e) {
    // Only warn if user explicitly provided a violations file
    if (opts?.violationsFile) {
      console.error(chalk.red("Could not read violations JSON:"), e instanceof Error ? e.message : e);
      process.exitCode = 1;
      return;
    }
  }

  const branch_name = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const developer_id = process.env.PI_CLI_DEVELOPER_ID?.trim() || undefined;

  const taskTracker = new CommandTaskTracker("resonate", `Resonate: ${intent.slice(0, 100)}`, {
    cwd,
    branch: branch_name,
  });
  taskTracker.startStep("context", "Load repo context");

  // Show rich status for context loading
  status.startPhase("loading-context");
  
  // Recall past architectural patterns for this category
  const category = extractCategoryFromIntent(intent);
  const pastPatterns = category ? recallPatterns({ cwd, category, limit: 5 }) : [];
  if (pastPatterns.length > 0) {
    console.log(chalk.magenta("💡 Recalling past patterns:"));
    for (const p of pastPatterns) {
      console.log(chalk.dim(`   • ${p.description} (${(p.confidence * 100).toFixed(0)}% confidence)`));
    }
    console.log("");
  }

  console.log(chalk.dim("◐ Loading repo context…"));
  let routine_context = await collectRoutineRepoContext(cwd, intent, {
    withExcerpts: deep,
  });
  
  status.completePhase("Context loaded");
  taskTracker.completeStep("context");
  taskTracker.startStep("session", "Staff engineer session");

  let git_diff_summary: string | undefined;
  if (opts?.staged) {
    git_diff_summary = await buildGitDiffSummary(cwd);
    console.log(chalk.dim(`◐ Staged/working diff summary: ${git_diff_summary.length} chars`));
  }

  // ---------- Workflow mode ----------
  if (opts?.workflow) {
    printLocalFirstBanner({ workflow: true });
    try {
      await runResonateWorkflow(cwd, intent, {
        ...opts,
        branch_name,
        developer_id,
        system_style,
        constitution,
        git_diff_summary,
        routine_context,
        taskTracker,
      });
      return;
    } catch (e) {
      console.log(chalk.yellow("Workflow mode failed, falling back to legacy mode."));
      console.log(chalk.dim(e instanceof Error ? e.message : String(e)));
    }
  }

  // ---------- Legacy stateless mode ----------
  printLocalFirstBanner({ workflow: false });

  const v2 = useV2Ui();
  const persona: PiPersona = getPersona();
  const pStyle = personaStyle(persona);
  let verbosity: "full" | "compact" = defaultVerbosity(persona);

  const introLine = v2
    ? `${chalk.bold[pStyle.accent](pStyle.label)}  ${chalk.dim(`${mode} · ${deep ? "deep" : "fast"}`)}`
    : chalk.cyan(`pi resonate — ${mode} mode`) + (deep ? chalk.dim(" (deep)") : chalk.dim(" (fast)"));
  intro(introLine);

  if (v2 && pStyle.greeting && !opts?.resume && !opts?.resumeSessionId) {
    console.log(shouldUseColor() ? chalk.dim(pStyle.greeting) : pStyle.greeting);
    console.log("");
  }

  let last: ResonateLastTurn | null = null;
  let activeSessionId: string | undefined = opts?.resumeSessionId;

  const persistSessionSnapshot = (params: {
    messages: ChatMsg[];
    lastTurn: ResonateLastTurn | null;
    markResolved?: boolean;
  }) => {
    if (!params.lastTurn) return;
    const st = params.markResolved ? "resolved" : params.lastTurn.session_status === "building" ? "building" : "question";
    const rec = upsertActiveSession({
      cwd,
      branch_name,
      session_id: activeSessionId,
      intent_summary: intent,
      thread_id: params.lastTurn.thread_id,
      last_pi_message: params.lastTurn.message,
      messages: params.messages,
      status: st,
      active_tasks: [taskTracker.rootTaskId],
      last_checkpoint: { task_id: taskTracker.rootTaskId },
    });
    activeSessionId = rec.session_id;
    const tr = getTaskById(taskTracker.rootTaskId);
    if (tr) saveTaskRecord({ ...tr, session_id: rec.session_id });
  };

  const onSigInt = () => {
    if (last) {
      persistSessionSnapshot({ messages, lastTurn: last });
      const resumeCmd = `pi "${intent.slice(0, 40)}${intent.length > 40 ? "…" : ""}"`;
      const body =
        (shouldUseColor() ? chalk.yellow("Session checkpoint saved.") : "Session checkpoint saved.") +
        "\n" +
        (shouldUseColor() ? chalk.dim("Resume any time with: ") + chalk.cyan(resumeCmd) + chalk.dim(" or ") + chalk.cyan("pi sessions") : `Resume with: ${resumeCmd} or pi sessions`);
      console.log("");
      console.log(body);
    }
    process.exit(0);
  };
  process.once("SIGINT", onSigInt);

  // Show thinking phase
  status.startPhase("evaluating-tradeoffs");

  for (;;) {
    // Prepare past patterns as additional context
    const patternsMemory = pastPatterns.length > 0 ? formatPatternsAsMemory(pastPatterns) : undefined;

    let data: Awaited<ReturnType<typeof client.resonateChat>>;
    const shouldAnimate = v2 && isInteractive() && shouldUseColor();
    const thinkingSpinner = shouldAnimate ? clack.spinner() : null;
    let tickTimer: NodeJS.Timeout | null = null;
    let untrackSpinner: (() => void) | null = null;
    if (thinkingSpinner) {
      thinkingSpinner.start(`Pi is thinking · ${status.phaseLabel()}`);
      untrackSpinner = trackSpinner(thinkingSpinner);
      tickTimer = setInterval(() => {
        try {
          const label = status.tick();
          thinkingSpinner.message(`Pi is thinking · ${label}`);
        } catch {
          /* ignore timer render errors */
        }
      }, 1500);
    }

    try {
      data = await client.resonateChat({
        intent,
        messages,
        branch_name,
        developer_id,
        system_style,
        routine_context: routine_context as Record<string, unknown>,
        mode,
        depth: deep ? "deep" : "fast",
        constitution,
        git_diff_summary,
        validate_context,
        ...(patternsMemory ? { past_patterns: patternsMemory } : {}),
      });
    } catch (err) {
      if (tickTimer) clearInterval(tickTimer);
      thinkingSpinner?.stop("Request failed.", 1);
      untrackSpinner?.();
      console.log("");
      console.log(
        renderErrorPanel(err, {
          hint: "Check connectivity with `pi doctor`, then resume with `pi sessions`.",
        })
      );
      persistSessionSnapshot({ messages, lastTurn: last });
      process.off("SIGINT", onSigInt);
      taskTracker.fail(err instanceof Error ? err : new Error("resonate api error"));
      outro(chalk.yellow("Session checkpoint saved — resume any time."));
      return;
    }
    if (tickTimer) clearInterval(tickTimer);
    thinkingSpinner?.stop(`Pi replied · ${(status.elapsedMs() / 1000).toFixed(1)}s`);
    untrackSpinner?.();

    validate_context = undefined;

    const session_status =
      data.session_status ??
      (data.is_ready && !data.open_questions?.length && data.conflict_type !== "hard_constraint" ? "building" : "question");
    const next_action =
      data.next_action ??
      (session_status === "building" && data.is_ready ? "approve" : "reply");

    last = {
      message: data.message,
      tradeoffs: data.tradeoffs,
      risks: data.risks,
      invariants: data.invariants,
      open_questions: data.open_questions,
      suggested_alternatives: data.suggested_alternatives,
      recommended_approach: data.recommended_approach,
      exit_criteria: data.exit_criteria,
      claims: normalizeClaims(data.claims),
      conflict_type: data.conflict_type,
      files_likely_touched: data.files_likely_touched,
      grounding_quality: data.grounding_quality,
      is_ready: data.is_ready,
      thread_id: data.thread_id,
      session_status,
      next_action,
    };

    const asstTurns = messages.filter((m) => m.role === "assistant").length;

    if (v2) {
      const turnMeta: TurnMeta = {
        threadId: data.thread_id,
        turnNumber: asstTurns + 1,
        sessionStatus: session_status,
        nextAction: next_action,
      };
      console.log("");
      console.log(renderPiTurnHeader(persona, turnMeta));
      console.log("");
      const detail = buildDetailSections(last, persona, { verbosity });
      console.log(
        renderPiBubble({
          message: data.message,
          persona,
          detail,
        })
      );
      console.log("");
    } else {
      console.log("");
      console.log(
        chalk.dim(
          `🧵 ${data.thread_id.slice(0, 18)}… · turn ~${asstTurns + 1} · ${session_status} · next: ${next_action}`
        )
      );
      console.log("");
      console.log(chalk.bold.cyan("Pi (Staff Engineer)"));
      console.log(formatAssistantBlock(last));
      console.log("");
    }

    messages.push({ role: "assistant", content: data.message });

    persistSessionSnapshot({ messages, lastTurn: last });

    // Complete thinking phase
    status.completePhase();

    if (next_action === "done" || session_status === "resolved") {
      console.log(chalk.dim("\n◒ Model signaled completion — finalizing session…"));
      break;
    }

    // Show next thinking phase if continuing
    if (messages.length < 10) {
      status.startPhase("evaluating-tradeoffs");
    }

    if (deep && data.files_likely_touched?.length) {
      routine_context = await mergeTargetedExcerpts(cwd, routine_context, data.files_likely_touched);
    }

    // Inner loop: accept slash commands that don't require another API turn
    // (e.g. /files, /risks, /help, /verbose) before asking for the next reply.
    let nextUserMessage: string | null = null;
    while (nextUserMessage === null) {
      if (v2) {
        console.log(renderTurnSeparator());
        console.log(renderUserTurnHeader(asstTurns + 1));
      }

      const hint =
        next_action === "approve" || next_action === "execute"
          ? chalk.gray('Reply, `/done` to save, `/help` for commands')
          : chalk.gray('Reply, `/done` to save, `/help` for commands');

      const reply = await text({
        message: hint,
        placeholder: "Your thoughts…",
      });

      if (isCancel(reply)) {
        persistSessionSnapshot({ messages, lastTurn: last });
        process.off("SIGINT", onSigInt);
        taskTracker.fail(new Error("cancelled"));
        outro(chalk.gray("Cancelled — session kept for resume."));
        return;
      }

      const parsed = parseUserReply(String(reply));

      if (parsed.kind === "empty") {
        continue; // reprompt
      }

      if (parsed.kind === "slash") {
        const cmd: SlashCommand = parsed.command;
        if (cmd === "done" || cmd === "save") {
          if (cmd === "save") {
            persistSessionSnapshot({ messages, lastTurn: last });
            console.log(chalk.green(shouldUseUnicode() ? "✓ Checkpoint saved" : "OK Checkpoint saved"));
            continue;
          }
          nextUserMessage = "__DONE__";
          break;
        }
        if (cmd === "cancel") {
          persistSessionSnapshot({ messages, lastTurn: last });
          process.off("SIGINT", onSigInt);
          taskTracker.fail(new Error("cancelled"));
          outro(chalk.gray("Cancelled — session kept for resume."));
          return;
        }
        if (cmd === "back") {
          // Re-analyze: clear assistant turns and restart the outer loop from scratch.
          messages = [{ role: "user", content: intent }];
          last = null;
          console.log(chalk.dim("↩  Re-analyzing from the top…"));
          nextUserMessage = "";
          break;
        }
        if (cmd === "help") {
          console.log(renderSlashHelp());
          continue;
        }
        if (cmd === "quiet") {
          verbosity = "compact";
          console.log(chalk.dim("verbosity = compact (risks/tradeoffs/claims hidden on next turn)"));
          continue;
        }
        if (cmd === "verbose") {
          verbosity = "full";
          console.log(chalk.dim("verbosity = full (all sections shown on next turn)"));
          continue;
        }
        if (cmd === "copy") {
          try {
            await clipboardy.write(last.message);
            console.log(chalk.dim(shouldUseUnicode() ? "📋 Copied Pi's last message to clipboard" : "Copied last message to clipboard"));
          } catch {
            console.log(chalk.yellow("Could not access clipboard."));
          }
          continue;
        }
        if (cmd === "files") {
          const files = last.files_likely_touched ?? [];
          if (!files.length) console.log(chalk.dim("No files listed in the last turn."));
          else for (const f of files) console.log(chalk.dim(`  ${f}`));
          continue;
        }
        if (cmd === "risks") {
          if (!last.risks.length) console.log(chalk.dim("No risks listed in the last turn."));
          else for (const r of last.risks) console.log(chalk.red(`  ! ${r}`));
          continue;
        }
        if (cmd === "deeper") {
          // Upgrade the routine context with more excerpts if we haven't already.
          if (deep) {
            console.log(chalk.dim("Already in deep mode."));
          } else {
            console.log(chalk.dim("◐ Upgrading to deep mode for next turn…"));
            routine_context = await collectRoutineRepoContext(cwd, intent, { withExcerpts: true });
          }
          nextUserMessage = "Please re-analyze with the expanded context — look for any prerequisites you may have missed.";
          break;
        }
        if (cmd === "explain") {
          nextUserMessage = "Explain your last answer in more depth, citing specific files and evidence. What would change your recommendation?";
          break;
        }
        // Fallback — treat unknown as help (parseUserReply already funnels here)
        console.log(renderSlashHelp());
        continue;
      }

      // Regular text reply
      nextUserMessage = parsed.content;
      break;
    }

    if (nextUserMessage === "__DONE__") {
      break;
    }
    if (nextUserMessage && nextUserMessage.length > 0) {
      messages.push({ role: "user", content: nextUserMessage });
    }
  }

  process.off("SIGINT", onSigInt);

  if (!last) {
    taskTracker.fail(new Error("No resonance output"));
    console.error(chalk.red("No resonance output to save."));
    process.exitCode = 1;
    return;
  }

  if (opts?.noSave) {
    persistSessionSnapshot({ messages, lastTurn: last });
    process.off("SIGINT", onSigInt);
    taskTracker.completeStep("session");
    taskTracker.complete();
    outro(chalk.green("Session ended (--no-save: file not written)."));
    return;
  }

  const rel = await writeResonanceFile(cwd, {
    intent,
    branch: branch_name,
    mode,
    depth: deep ? "deep" : "fast",
    messages,
    last,
  });

  // Learn architectural patterns from this session
  const learnedExtras: string[] = [];
  if (last.is_ready && last.recommended_approach.label !== "none") {
    const category = extractCategoryFromIntent(intent);
    if (category) {
      const patternDesc = `${last.recommended_approach.rationale.slice(0, 100)}`;
      recordPattern({
        cwd,
        category,
        description: patternDesc,
        evidence: [rel, ...(last.files_likely_touched ?? []).slice(0, 3)],
        patternType: last.conflict_type === "none" ? "team_preference" : "constraint",
        confidence: last.is_ready ? 0.8 : 0.5,
      });
      const disk = shouldUseUnicode() ? "💾" : "*";
      learnedExtras.push(
        shouldUseColor()
          ? chalk.dim(`${disk} Learned pattern for future ${category} decisions`)
          : `${disk} Learned pattern for future ${category} decisions`
      );
    }
  }

  if (activeSessionId) {
    upsertActiveSession({
      cwd,
      branch_name,
      session_id: activeSessionId,
      intent_summary: intent,
      thread_id: last.thread_id,
      last_pi_message: last.message,
      messages,
      status: "resolved",
      resonance_rel: rel,
      active_tasks: [],
      completed_tasks: [taskTracker.rootTaskId],
      last_checkpoint: { task_id: taskTracker.rootTaskId },
    });
  }

  const handoffRel = await writeHandoffFile(cwd, {
    intent,
    branch: branch_name,
    mode,
    depth: deep ? "deep" : "fast",
    last,
    resonanceRel: rel,
  });

  let planRel: string | undefined;
  if (opts?.plan) {
    const planMd = buildLocalShadowPlan(intent, last);
    planRel = await writeShadowPlan(cwd, planMd);
  }

  const routineCmd = `pi routine "${intent.replace(/"/g, '\\"')}"${deep ? " --with-excerpts" : ""}`;

  let clipboardCopied = false;
  try {
    await clipboardy.write(routineCmd);
    clipboardCopied = true;
  } catch {
    /* clipboard unavailable — fine */
  }

  if (v2) {
    const recap: RecapSummary = {
      intent,
      persona,
      invariants: last.invariants,
      exitCriteria: last.exit_criteria,
      filesLikelyTouched: last.files_likely_touched,
      resonanceRel: rel,
      handoffRel,
      planRel,
      nextCommand: routineCmd,
      clipboardCopied,
      extras: learnedExtras,
    };
    console.log("");
    console.log(renderRecapCard(recap));
  } else {
    // v1 fallback — keep exact legacy formatting for script-parseable output.
    console.log(chalk.green("✓"), "Saved resonance:", rel);
    for (const line of learnedExtras) console.log(line);
    console.log(chalk.green("✓"), "Handoff contract:", handoffRel);
    if (planRel) {
      console.log(chalk.green("✓"), `Shadow plan written: ${planRel}`);
      console.log(chalk.dim("→ Execute steps with: pi execute 1"));
    }
    console.log(chalk.dim("→ Feed to Cursor or run:"), chalk.cyan(routineCmd));
  }

  if (opts?.export) {
    console.log("");
    console.log(chalk.bold.green("Handoff (copy/paste):"));
    console.log(chalk.cyan(routineCmd));
    console.log(chalk.dim(`Resonance: ${rel}`));
    console.log(chalk.dim(`Agent contract: ${handoffRel}`));
  }

  taskTracker.completeStep("session");
  taskTracker.complete();
  status.complete();
  outro(chalk.green("Resonance complete."));
}

/** Approve a pending team system-style draft (tech_lead / admin API key). */
export async function runResonateApprove(_cwd: string, draftId: string): Promise<void> {
  const client = new PiApiClient();
  const r = await client.resonateApprove(draftId);
  console.log(chalk.green("✓"), "Approved draft:", r.draft_id ?? draftId);
}
