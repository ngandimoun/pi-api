/**
 * Slash-command registry for the `pi resonate` conversation loop.
 *
 * Replaces the ad-hoc string checks against `"done" | "exit" | "quit"` with
 * a proper command parser that tolerates typos (leading/trailing whitespace,
 * case, optional `/` prefix) and exposes help text.
 */

import boxen from "boxen";
import chalk from "chalk";
import { shouldUseColor, shouldUseUnicode, terminalWidth } from "./chat-ui.js";

export type SlashCommand =
  | "done"
  | "save"
  | "back"
  | "deeper"
  | "explain"
  | "quiet"
  | "verbose"
  | "copy"
  | "help"
  | "files"
  | "risks"
  | "cancel";

export type ParsedReply =
  | { kind: "slash"; command: SlashCommand; arg?: string }
  | { kind: "text"; content: string }
  | { kind: "empty" };

type CommandSpec = {
  id: SlashCommand;
  /** Aliases that do NOT need the `/` prefix (legacy sentinel words). */
  sentinelAliases?: string[];
  /** Aliases that DO need a `/` (or plain `/foo`). */
  slashAliases?: string[];
  summary: string;
};

const SPECS: CommandSpec[] = [
  {
    id: "done",
    sentinelAliases: ["done", "exit", "quit"],
    slashAliases: ["done", "end", "finish"],
    summary: "Finalize the session and write artifacts",
  },
  {
    id: "save",
    slashAliases: ["save", "checkpoint"],
    summary: "Persist progress without ending the session",
  },
  {
    id: "back",
    sentinelAliases: ["back", "go back", "restart"],
    slashAliases: ["back", "restart"],
    summary: "Re-analyze from the top",
  },
  {
    id: "deeper",
    slashAliases: ["deeper", "deep"],
    summary: "Upgrade to deep mode (loads more excerpts)",
  },
  {
    id: "explain",
    slashAliases: ["explain", "why"],
    summary: "Ask Pi to elaborate on the last turn",
  },
  {
    id: "quiet",
    slashAliases: ["quiet", "q"],
    summary: "Hide structured detail (risks / tradeoffs / claims)",
  },
  {
    id: "verbose",
    slashAliases: ["verbose", "v"],
    summary: "Show structured detail for every Pi turn",
  },
  {
    id: "copy",
    slashAliases: ["copy", "yank"],
    summary: "Copy the last Pi message to clipboard",
  },
  {
    id: "files",
    slashAliases: ["files", "ls"],
    summary: "List files likely touched (from last turn)",
  },
  {
    id: "risks",
    slashAliases: ["risks", "warn"],
    summary: "Show risks from the last Pi turn",
  },
  {
    id: "cancel",
    sentinelAliases: ["cancel", "abort"],
    slashAliases: ["cancel", "abort"],
    summary: "Cancel the session without saving",
  },
  {
    id: "help",
    slashAliases: ["help", "h", "?"],
    summary: "Show this help panel",
  },
];

const SENTINEL_MAP = new Map<string, SlashCommand>();
const SLASH_MAP = new Map<string, SlashCommand>();
for (const spec of SPECS) {
  for (const a of spec.sentinelAliases ?? []) SENTINEL_MAP.set(a.toLowerCase(), spec.id);
  for (const a of spec.slashAliases ?? []) SLASH_MAP.set(a.toLowerCase(), spec.id);
}

/**
 * Parse a user reply from the conversation loop.
 *
 * - `""` / whitespace           → `{kind: "empty"}`
 * - `/cmd [arg]`                → `{kind: "slash", command, arg}` (if known)
 * - `done`/`exit`/`quit`/etc    → `{kind: "slash", command}` (legacy sentinels)
 * - anything else               → `{kind: "text", content}`
 */
export function parseUserReply(raw: string): ParsedReply {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty" };

  if (trimmed.startsWith("/")) {
    const rest = trimmed.slice(1).trimStart();
    const firstSpace = rest.search(/\s/);
    const head = (firstSpace < 0 ? rest : rest.slice(0, firstSpace)).toLowerCase();
    const arg = firstSpace < 0 ? undefined : rest.slice(firstSpace + 1).trim();
    const cmd = SLASH_MAP.get(head);
    if (cmd) {
      return { kind: "slash", command: cmd, ...(arg ? { arg } : {}) };
    }
    // Unknown slash — surface as help so user learns what's available.
    return { kind: "slash", command: "help" };
  }

  const sentinel = SENTINEL_MAP.get(trimmed.toLowerCase());
  if (sentinel) return { kind: "slash", command: sentinel };

  return { kind: "text", content: trimmed };
}

/** Render the slash-command help panel. */
export function renderSlashHelp(): string {
  const c = shouldUseColor();
  const lines: string[] = [];
  for (const spec of SPECS) {
    const slashes = (spec.slashAliases ?? []).map((a) => `/${a}`);
    const sentinels = spec.sentinelAliases ?? [];
    const all = [...slashes, ...sentinels];
    const head = all.length ? all.join(", ") : `/${spec.id}`;
    const label = c ? chalk.cyan(head.padEnd(28)) : head.padEnd(28);
    const summary = c ? chalk.dim(spec.summary) : spec.summary;
    lines.push(`${label} ${summary}`);
  }
  const body = lines.join("\n");

  if (!shouldUseUnicode() || !shouldUseColor()) {
    return `=== Slash commands ===\n${body}\n`;
  }

  return boxen(body, {
    borderStyle: "round",
    borderColor: "cyan",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    width: Math.min(72, terminalWidth() - 2),
    title: chalk.bold.cyan("Slash commands"),
    titleAlignment: "left",
    dimBorder: true,
  });
}

/** Expose registry for tests / external consumers (read-only). */
export function listSlashCommands(): ReadonlyArray<{ id: SlashCommand; summary: string; aliases: string[] }> {
  return SPECS.map((s) => ({
    id: s.id,
    summary: s.summary,
    aliases: [
      ...(s.slashAliases ?? []).map((a) => `/${a}`),
      ...(s.sentinelAliases ?? []),
    ],
  }));
}
