/**
 * Core rendering primitives for the Pi CLI conversation experience.
 *
 * All helpers are pure (string in, string out) and respect `NO_COLOR`,
 * `TERM=dumb`, non-TTY, and legacy Windows consoles. Heavy visual features
 * (boxed bubbles, markdown, gradients) degrade gracefully to plain text
 * when color/unicode aren't available.
 */

import boxen, { type Options as BoxenOptions } from "boxen";
import chalk from "chalk";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

import type { PiPersona } from "../config.js";
import { bubbleAccent, piLabel, type PersonaStyle } from "./persona-style.js";

// ---------------------------------------------------------------------------
// Environment helpers — single source of truth for color / unicode / TTY.
// ---------------------------------------------------------------------------

/** Whether we can emit ANSI colors safely. */
export function shouldUseColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") return true;
  if (process.env.TERM === "dumb") return false;
  if (!process.stdout.isTTY) return false;
  if (process.env.CI && !process.env.PI_CLI_FORCE_COLOR) return false;
  return true;
}

/** Whether the terminal likely handles box-drawing / emoji correctly. */
export function shouldUseUnicode(): boolean {
  if (process.env.PI_CLI_ASCII === "1") return false;
  if (process.platform === "win32") {
    // Windows Terminal / VSCode / modern PowerShell all set one of these.
    if (process.env.WT_SESSION) return true;
    if (process.env.TERM_PROGRAM) return true;
    if (process.env.ConEmuTask) return true;
    // Legacy conhost.exe — assume no UTF-8.
    return false;
  }
  const locale = process.env.LANG ?? process.env.LC_ALL ?? "";
  return /UTF-?8/i.test(locale) || Boolean(process.stdout.isTTY);
}

/** Whether we're in an interactive TTY. */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Current terminal width, clamped to sensible bounds. */
export function terminalWidth(): number {
  const w = process.stdout.columns ?? 80;
  return Math.max(40, Math.min(w, 160));
}

/** Width available inside a bubble (terminal width minus borders + pad). */
export function bubbleContentWidth(): number {
  return Math.max(20, terminalWidth() - 6);
}

// ---------------------------------------------------------------------------
// Marked-terminal setup — one-time, idempotent.
// ---------------------------------------------------------------------------

let markedConfigured = false;

/** Configure marked + marked-terminal once. Safe to call many times. */
export function setupMarkedTerminal(width?: number): void {
  if (markedConfigured) return;
  const useColor = shouldUseColor();
  const w = width ?? bubbleContentWidth();

  marked.use(
    markedTerminal(
      {
        width: w,
        reflowText: true,
        tab: 2,
        showSectionPrefix: false,
        // When color is off, return plain strings for every styled token.
        code: useColor ? chalk.yellow : (s: string) => s,
        blockquote: useColor ? chalk.gray.italic : (s: string) => s,
        heading: useColor ? chalk.cyan.bold : (s: string) => s,
        firstHeading: useColor ? chalk.cyan.bold : (s: string) => s,
        strong: useColor ? chalk.bold : (s: string) => s,
        em: useColor ? chalk.italic : (s: string) => s,
        codespan: useColor ? chalk.yellow : (s: string) => `\`${s}\``,
        link: useColor ? chalk.cyan.underline : (s: string) => s,
        href: useColor ? chalk.cyan.underline : (s: string) => s,
        list: (body: string) => body,
        listitem: useColor ? chalk.reset : (s: string) => s,
      } as Record<string, unknown>
    ) as never
  );

  markedConfigured = true;
}

/** Safely render markdown text to terminal-styled output. */
export function renderMarkdown(input: string): string {
  setupMarkedTerminal();
  // Defensive: strip raw <script>/<iframe> from LLM output.
  const sanitized = String(input ?? "").replace(
    /<(script|iframe|object|embed)[\s\S]*?<\/\1>/gi,
    ""
  );
  try {
    const out = marked.parse(sanitized, { async: false }) as string;
    // Trim trailing newlines marked adds.
    return out.replace(/\n+$/, "");
  } catch {
    // Fallback to raw text if marked throws on malformed input.
    return sanitized;
  }
}

// ---------------------------------------------------------------------------
// Turn headers and separators
// ---------------------------------------------------------------------------

export type TurnMeta = {
  threadId: string;
  turnNumber: number;
  sessionStatus: "question" | "building" | "resolved";
  nextAction: "reply" | "approve" | "execute" | "done";
};

/** Render the "Pi · Staff Engineer" header with meta chips. */
export function renderPiTurnHeader(persona: PiPersona, meta: TurnMeta): string {
  const label = piLabel(persona);
  const accent = bubbleAccent(persona);
  if (!shouldUseColor()) {
    return `${label}  [${meta.sessionStatus} · next: ${meta.nextAction}]`;
  }
  const badge = chalk.bold[accent](label);
  const chips = [
    chalk.dim(`thread ${meta.threadId.slice(0, 8)}`),
    chalk.dim(`turn ${meta.turnNumber}`),
    statusChip(meta.sessionStatus),
    nextActionChip(meta.nextAction),
  ].join(chalk.dim(" · "));
  return `${badge}\n${chips}`;
}

function statusChip(s: TurnMeta["sessionStatus"]): string {
  if (!shouldUseColor()) return s;
  switch (s) {
    case "question":
      return chalk.yellow("asking");
    case "building":
      return chalk.green("building");
    case "resolved":
      return chalk.cyan("resolved");
  }
}

function nextActionChip(a: TurnMeta["nextAction"]): string {
  if (!shouldUseColor()) return `next: ${a}`;
  switch (a) {
    case "reply":
      return chalk.dim("next: reply");
    case "approve":
      return chalk.green("next: approve");
    case "execute":
      return chalk.magenta("next: execute");
    case "done":
      return chalk.cyan("next: done");
  }
}

/** Render the "You · 02" header above a user reply in the transcript. */
export function renderUserTurnHeader(turnNumber: number): string {
  const n = String(turnNumber).padStart(2, "0");
  if (!shouldUseColor()) return `You  [${n}]`;
  return chalk.bold.white("You") + chalk.dim(`  ${n}`);
}

/** A subtle horizontal rule between turns. */
export function renderTurnSeparator(): string {
  const w = terminalWidth();
  const ch = shouldUseUnicode() ? "─" : "-";
  const rule = ch.repeat(Math.max(10, Math.floor(w / 3)));
  return shouldUseColor() ? chalk.dim(rule) : rule;
}

// ---------------------------------------------------------------------------
// Pi chat bubble (markdown-rendered, boxed)
// ---------------------------------------------------------------------------

export type PiBubbleInput = {
  /** Raw markdown message from the agent. */
  message: string;
  persona: PiPersona;
  style?: PersonaStyle;
  /** Optional appended structured detail (risks/tradeoffs/claims). */
  detail?: string;
};

/**
 * Render Pi's response as a persona-themed chat bubble.
 * Gracefully degrades to plain markdown when unicode/color are off.
 */
export function renderPiBubble(input: PiBubbleInput): string {
  const body = renderMarkdown(input.message);
  const detail = input.detail?.trim() ? `\n\n${input.detail.trim()}` : "";
  const full = `${body}${detail}`;

  if (!shouldUseUnicode() || !shouldUseColor()) {
    return full;
  }

  const accent = bubbleAccent(input.persona);
  const opts: BoxenOptions = {
    borderStyle: "round",
    borderColor: accent,
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    width: terminalWidth() - 2,
    dimBorder: true,
  };
  return boxen(full, opts);
}

// ---------------------------------------------------------------------------
// Recap card (end of session summary)
// ---------------------------------------------------------------------------

export type RecapSummary = {
  intent: string;
  persona: PiPersona;
  invariants?: string[];
  exitCriteria?: string[];
  filesLikelyTouched?: string[];
  resonanceRel?: string;
  handoffRel?: string;
  planRel?: string;
  nextCommand?: string;
  clipboardCopied?: boolean;
  /** Arbitrary extra lines (e.g. "💾 Learned pattern for billing decisions"). */
  extras?: string[];
};

function titleCase(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

export function renderRecapCard(summary: RecapSummary): string {
  const lines: string[] = [];
  const c = shouldUseColor();
  const bold = (s: string) => (c ? chalk.bold(s) : s);
  const dim = (s: string) => (c ? chalk.dim(s) : s);
  const cyan = (s: string) => (c ? chalk.cyan(s) : s);
  const green = (s: string) => (c ? chalk.green(s) : s);

  lines.push(bold("Intent"));
  lines.push(`  ${summary.intent}`);

  if (summary.invariants?.length) {
    lines.push("", bold("Invariants"));
    for (const i of summary.invariants.slice(0, 5)) lines.push(`  • ${i}`);
  }

  if (summary.exitCriteria?.length) {
    lines.push("", bold("Exit criteria"));
    for (const i of summary.exitCriteria.slice(0, 5)) lines.push(`  • ${i}`);
  }

  if (summary.filesLikelyTouched?.length) {
    lines.push("", bold("Files likely touched"));
    for (const f of summary.filesLikelyTouched.slice(0, 6))
      lines.push(`  ${dim(f)}`);
  }

  const artifacts: string[] = [];
  if (summary.resonanceRel) artifacts.push(`Resonance: ${dim(summary.resonanceRel)}`);
  if (summary.handoffRel) artifacts.push(`Handoff:   ${dim(summary.handoffRel)}`);
  if (summary.planRel) artifacts.push(`Plan:      ${dim(summary.planRel)}`);
  if (artifacts.length) {
    lines.push("", bold("Saved"));
    for (const a of artifacts) lines.push(`  ${green("✓")} ${a}`);
  }

  if (summary.nextCommand) {
    lines.push("", bold("Next step"));
    lines.push(`  ${cyan(summary.nextCommand)}`);
    if (summary.clipboardCopied) {
      lines.push(`  ${dim(shouldUseUnicode() ? "📋 copied to clipboard" : "(copied to clipboard)")}`);
    }
  }

  if (summary.extras?.length) {
    lines.push("");
    for (const e of summary.extras) lines.push(`  ${e}`);
  }

  const body = lines.join("\n");

  if (!shouldUseUnicode() || !shouldUseColor()) {
    return `=== ${titleCase(summary.persona)} recap ===\n${body}\n`;
  }

  const accent = bubbleAccent(summary.persona);
  return boxen(body, {
    borderStyle: "round",
    borderColor: accent,
    padding: 1,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    width: terminalWidth() - 2,
    title: chalk.bold[accent]("Resonance complete"),
    titleAlignment: "left",
  });
}

// ---------------------------------------------------------------------------
// Error panel
// ---------------------------------------------------------------------------

export function renderErrorPanel(err: unknown, opts?: { hint?: string; title?: string }): string {
  const msg = err instanceof Error ? err.message : String(err);
  const hint = opts?.hint ?? "Run `pi doctor` to verify connectivity and auth.";
  const c = shouldUseColor();
  const body = c ? `${chalk.red(msg)}\n\n${chalk.dim(hint)}` : `${msg}\n\n${hint}`;

  if (!shouldUseUnicode() || !shouldUseColor()) {
    return `!!! ${opts?.title ?? "Error"} !!!\n${body}\n`;
  }

  return boxen(body, {
    borderStyle: "round",
    borderColor: "red",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    width: terminalWidth() - 2,
    title: chalk.bold.red(opts?.title ?? "Something went wrong"),
    titleAlignment: "left",
  });
}

// ---------------------------------------------------------------------------
// Thinking line — single-line animated status ("Pi is thinking · 3.2s")
// ---------------------------------------------------------------------------

export function renderThinkingLine(phaseLabel: string, elapsedMs: number): string {
  const secs = (elapsedMs / 1000).toFixed(1);
  if (!shouldUseColor()) return `Pi is thinking · ${phaseLabel} · ${secs}s`;
  return (
    chalk.cyan("Pi is thinking") +
    chalk.dim(" · ") +
    chalk.white(phaseLabel) +
    chalk.dim(` · ${secs}s`)
  );
}

// ---------------------------------------------------------------------------
// Resume-session preview (used by omni-router)
// ---------------------------------------------------------------------------

export type ResumePreviewInput = {
  score: number;
  intentSummary: string;
  lastPiMessage: string;
  sessionId: string;
};

export function renderResumePreview(input: ResumePreviewInput): string {
  const c = shouldUseColor();
  const pct = `${(input.score * 100).toFixed(0)}% match`;
  const header = c ? chalk.bold.cyan(input.intentSummary.slice(0, 80)) : input.intentSummary.slice(0, 80);
  const scoreLine = c ? chalk.dim(`Match score: ${pct}`) : `Match score: ${pct}`;
  const preview = input.lastPiMessage.replace(/\s+/g, " ").slice(0, 180);
  const body = `${header}\n${scoreLine}\n\n${c ? chalk.dim("Last Pi turn:") : "Last Pi turn:"}\n${preview}${preview.length >= 180 ? "…" : ""}`;

  if (!shouldUseUnicode() || !shouldUseColor()) {
    return `-- Resuming session (${pct}) --\n${body}\n`;
  }

  return boxen(body, {
    borderStyle: "round",
    borderColor: "cyan",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    width: terminalWidth() - 2,
    dimBorder: true,
    title: chalk.bold.cyan("Resume in-flight session?"),
    titleAlignment: "left",
  });
}

// ---------------------------------------------------------------------------
// SIGWINCH — invalidate cached widths on terminal resize.
// ---------------------------------------------------------------------------

if (typeof process.on === "function" && process.platform !== "win32") {
  try {
    process.on("SIGWINCH", () => {
      // Force re-setup of marked-terminal with new width on next render.
      markedConfigured = false;
    });
  } catch {
    /* SIGWINCH not supported — fine */
  }
}

// ---------------------------------------------------------------------------
// Spinner registry — tracks active clack spinners so SIGINT handlers can
// stop them cleanly and avoid leaving a dangling braille frame.
// ---------------------------------------------------------------------------

type Stoppable = { stop: (msg?: string, code?: number) => void };
const ACTIVE_SPINNERS = new Set<Stoppable>();

/** Register a spinner so it will be stopped on SIGINT. Returns an unregister fn. */
export function trackSpinner(s: Stoppable): () => void {
  ACTIVE_SPINNERS.add(s);
  return () => ACTIVE_SPINNERS.delete(s);
}

/** Stop every tracked spinner. Safe to call multiple times. */
export function stopAllSpinners(msg?: string): void {
  for (const s of Array.from(ACTIVE_SPINNERS)) {
    try {
      s.stop(msg, 1);
    } catch {
      /* ignore */
    }
    ACTIVE_SPINNERS.delete(s);
  }
}

// Install a single top-level SIGINT handler that cleans up spinners before
// any command-level handler runs. Uses `prependListener` so it fires first,
// but does not call `process.exit` — the command-level handler still owns
// exit behavior (checkpoint, etc).
if (typeof process.on === "function") {
  let installed = false;
  const install = () => {
    if (installed) return;
    installed = true;
    try {
      process.prependListener("SIGINT", () => {
        stopAllSpinners();
      });
    } catch {
      /* ignore */
    }
  };
  install();
}
