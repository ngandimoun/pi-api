import { SyntaxKind, type SourceFile, type StringLiteral } from "ts-morph";

import type { RuleViolation } from "./violation-types.js";

/** Keep only violations whose generated patch meets the confidence floor (0–1). */
export function filterViolationsByPatchConfidence(
  violations: RuleViolation[],
  patches: DeterministicPatch[],
  threshold: number
): RuleViolation[] {
  if (threshold <= 0) return violations;
  return violations.filter((v) => {
    const match = patches.find(
      (p) =>
        p.file === v.file &&
        p.rule === v.rule &&
        (p.patch.start.line === v.line || (v.rule === "no-missing-react-keys" && p.patch.start.line === v.line))
    );
    if (!match) return true;
    return match.confidence >= threshold;
  });
}

/** Machine-readable surgical patch for deterministic Sharingan fixes (breaks AI ping-pong loops). */
export type DeterministicPatch = {
  file: string;
  rule: string;
  patch: {
    start: { line: number; column: number };
    end: { line: number; column: number };
    oldText: string;
    newText: string;
  };
  /** 0–1; higher = safer to auto-apply */
  confidence: number;
  astNodePath?: string;
  /** When oldText/newText are not enough (e.g. React key injection), point to `pi fix`. */
  hint?: string;
};

const HEX_IN_CLASS = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/;

function replaceAllCaseInsensitive(input: string, needle: string, replacement: string): string {
  return input.replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replacement);
}

/** Mirror of fix-autofix hex transform (preview only). */
export function previewHexClassStringFix(raw: string): string {
  let next = raw;
  next = replaceAllCaseInsensitive(next, "#ffffff", "bg-background");
  next = replaceAllCaseInsensitive(next, "#fff", "bg-background");
  next = replaceAllCaseInsensitive(next, "#000000", "bg-foreground");
  next = replaceAllCaseInsensitive(next, "#000", "bg-foreground");
  next = next.replace(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/gi, "bg-muted");
  return next;
}

export function previewZIndexClassStringFix(raw: string): string {
  return raw.replace(/z-\[[^\]]+\]/g, "z-50");
}

function lineAndColumn(sf: SourceFile, pos: number): { line: number; column: number } {
  const lc = sf.getLineAndColumnAtPos(pos);
  return { line: lc.line, column: lc.column };
}

/**
 * Build structured patches for violations in a single file. Safe to run read-only (no mutations).
 */
export function generateDeterministicPatches(sf: SourceFile, violations: RuleViolation[]): DeterministicPatch[] {
  const out: DeterministicPatch[] = [];
  const fp = sf.getFilePath();

  for (const v of violations) {
    if (v.file !== fp) continue;

    if (v.rule === "no-hardcoded-hex") {
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.StringLiteral) return;
        const lit = node as StringLiteral;
        if (lit.getStartLineNumber() !== v.line) return;
        const raw = lit.getLiteralValue();
        if (!HEX_IN_CLASS.test(raw)) return;
        const next = previewHexClassStringFix(raw);
        if (next === raw) return;
        const start = lit.getStart() + 1;
        const end = lit.getEnd() - 1;
        const s = lineAndColumn(sf, start);
        const e = lineAndColumn(sf, end);
        out.push({
          file: fp,
          rule: v.rule,
          confidence: 0.95,
          astNodePath: `StringLiteral@${v.line}:${v.column}`,
          patch: {
            start: s,
            end: e,
            oldText: raw,
            newText: next,
          },
        });
      });
      continue;
    }

    if (v.rule === "no-z-index-chaos") {
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.StringLiteral) return;
        const lit = node as StringLiteral;
        if (lit.getStartLineNumber() !== v.line) return;
        const raw = lit.getLiteralValue();
        if (!/z-\[[^\]]+\]/.test(raw)) return;
        const next = previewZIndexClassStringFix(raw);
        if (next === raw) return;
        const start = lit.getStart() + 1;
        const end = lit.getEnd() - 1;
        const s = lineAndColumn(sf, start);
        const e = lineAndColumn(sf, end);
        out.push({
          file: fp,
          rule: v.rule,
          confidence: 0.9,
          astNodePath: `StringLiteral@${v.line}:${v.column}`,
          patch: {
            start: s,
            end: e,
            oldText: raw,
            newText: next,
          },
        });
      });
      continue;
    }

    if (v.rule === "no-missing-react-keys") {
      out.push({
        file: fp,
        rule: v.rule,
        confidence: 0.75,
        astNodePath: `JsxOpening@${v.line}:${v.column}`,
        hint: "Run `pi fix` to surgically inject a stable key (ts-morph AST); avoid hand-editing to prevent ping-pong with the linter.",
        patch: {
          start: { line: v.line, column: v.column },
          end: { line: v.line, column: v.column },
          oldText: "",
          newText: "",
        },
      });
    }
  }

  return out;
}
