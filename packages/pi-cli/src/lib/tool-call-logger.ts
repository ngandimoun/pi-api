import * as p from "@clack/prompts";
import chalk from "chalk";
import { shouldUseColor, shouldUseUnicode } from "./ui/chat-ui.js";

export type ToolCallEvent = {
  tool: string;
  status: "start" | "success" | "error";
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs?: number;
};

export class ToolCallLogger {
  private enabled: boolean;
  private startTimes: Map<string, number>;

  constructor(enabled: boolean = true) {
    this.enabled = enabled && process.stdout.isTTY;
    this.startTimes = new Map();
  }

  /** Is this logger currently emitting output? */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Log the start of a tool call. Routes through `@clack/prompts`' pipe when
   * available so the output lines up with the rest of the conversation UI.
   */
  logStart(tool: string, params?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const callId = `${tool}-${Date.now()}`;
    this.startTimes.set(callId, Date.now());

    const icon = this.getToolIcon(tool);
    const paramsPreview = this.formatParams(params);
    const line = `${icon} ${tool}${paramsPreview}`;
    emitPiped("step", shouldUseColor() ? chalk.cyan(line) : line);
  }

  /** Log successful tool completion. */
  logSuccess(tool: string, _result?: unknown, summary?: string): void {
    if (!this.enabled) return;

    const duration = this.getDuration(tool);
    const durationStr = duration ? ` (${(duration / 1000).toFixed(2)}s)` : "";
    const ok = shouldUseUnicode() ? "✓" : "OK";
    const body = summary ? `${ok} ${summary}${durationStr}` : `${ok} Complete${durationStr}`;
    emitPiped("info", shouldUseColor() ? chalk.green(body) : body);
  }

  /** Log tool error. */
  logError(tool: string, error: string): void {
    if (!this.enabled) return;
    // `tool` kept in signature so callers can log per-tool; silence unused-var.
    void tool;
    const bad = shouldUseUnicode() ? "✗" : "FAIL";
    const body = `${bad} ${error}`;
    emitPiped("warn", shouldUseColor() ? chalk.red(body) : body);
  }

  /** Log a progress update during tool execution. */
  logProgress(message: string): void {
    if (!this.enabled) return;
    const arrow = shouldUseUnicode() ? "→" : "->";
    const body = `${arrow} ${message}`;
    emitPiped("info", shouldUseColor() ? chalk.dim(body) : body);
  }

  private getToolIcon(tool: string): string {
    if (shouldUseUnicode()) {
      const icons: Record<string, string> = {
        "query-system-style": "📋",
        "query-dependency-graph": "🔍",
        "extract-ast-snippet": "🔬",
        "blast-radius": "💥",
        "prerequisite-scanner": "🔎",
        "architectural-boundary": "🏗️",
      };
      return icons[tool] ?? "🔧";
    }
    const ascii: Record<string, string> = {
      "query-system-style": "[style]",
      "query-dependency-graph": "[graph]",
      "extract-ast-snippet": "[ast]",
      "blast-radius": "[blast]",
      "prerequisite-scanner": "[prereq]",
      "architectural-boundary": "[bounds]",
    };
    return ascii[tool] ?? "[tool]";
  }

  private formatParams(params?: Record<string, unknown>): string {
    if (!params || Object.keys(params).length === 0) return "";

    const keys = Object.keys(params);
    if (keys.length === 1 && typeof params[keys[0]] === "string") {
      const val = String(params[keys[0]]);
      return chalk.dim(` "${val.slice(0, 40)}${val.length > 40 ? "..." : ""}"`);
    }

    return chalk.dim(` (${keys.join(", ")})`);
  }

  private getDuration(tool: string): number | undefined {
    // Find most recent call for this tool
    const entries = Array.from(this.startTimes.entries())
      .filter(([k]) => k.startsWith(tool))
      .sort(([, a], [, b]) => b - a);

    if (entries.length === 0) return undefined;

    const [callId, startTime] = entries[0];
    this.startTimes.delete(callId);
    return Date.now() - startTime;
  }
}

/**
 * Emit a line using clack's vertical pipe when a clack session is active,
 * falling back to plain `console.log` otherwise.
 */
function emitPiped(kind: "step" | "info" | "warn", msg: string): void {
  try {
    const log = (p as unknown as {
      log?: {
        step?: (m: string) => void;
        info?: (m: string) => void;
        warn?: (m: string) => void;
      };
    }).log;
    if (log?.[kind]) {
      log[kind]!(msg);
      return;
    }
  } catch {
    /* clack pipe unavailable — fall through */
  }
  console.log(msg);
}

/**
 * Global tool call logger instance
 */
let globalLogger: ToolCallLogger | null = null;

export function initToolCallLogger(enabled: boolean = true): ToolCallLogger {
  globalLogger = new ToolCallLogger(enabled);
  return globalLogger;
}

export function getToolCallLogger(): ToolCallLogger | null {
  return globalLogger;
}

/**
 * Convenience wrapper for logging tool calls
 */
export async function withToolCallLogging<T>(
  tool: string,
  params: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
  opts?: { successSummary?: (result: T) => string }
): Promise<T> {
  const logger = getToolCallLogger();
  
  logger?.logStart(tool, params);
  
  try {
    const result = await fn();
    const summary = opts?.successSummary?.(result);
    logger?.logSuccess(tool, result, summary);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger?.logError(tool, errorMsg);
    throw error;
  }
}
