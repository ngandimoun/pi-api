import {
  SyntaxKind,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type Node,
  type SourceFile,
  type StringLiteral,
} from "ts-morph";

import type { RuleViolation } from "./rules/violation-types.js";

function replaceAllCaseInsensitive(input: string, needle: string, replacement: string): string {
  return input.replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replacement);
}

function tryFixMissingReactKeyFromMap(sf: SourceFile, line: number): boolean {
  // Find JSX opening on the given line (best-effort).
  const selfClosing = sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).filter((n) => n.getStartLineNumber() === line);
  const openTags = sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).filter((n) => n.getStartLineNumber() === line);
  const hits: Array<JsxSelfClosingElement | JsxOpeningElement> = [...selfClosing, ...openTags];

  for (const opening of hits) {
    const already = opening.getAttributes().some((a) => {
      if (a.getKind() !== SyntaxKind.JsxAttribute) return false;
      return a.asKindOrThrow(SyntaxKind.JsxAttribute).getNameNode().getText() === "key";
    });
    if (already) continue;

    // Walk up to find a .map call expression containing this JSX.
    let cur: Node | undefined = opening.getParent();
    while (cur) {
      if (cur.getKind() === SyntaxKind.CallExpression) {
        const call = cur.asKindOrThrow(SyntaxKind.CallExpression);
        if (call.getExpression().getText().endsWith(".map")) {
          const cb = call.getArguments()[0];
          let paramName: string | undefined;
          if (cb?.getKind() === SyntaxKind.ArrowFunction) {
            const ps = cb.asKindOrThrow(SyntaxKind.ArrowFunction).getParameters();
            paramName = ps[0]?.getName();
          } else if (cb?.getKind() === SyntaxKind.FunctionExpression) {
            const ps = cb.asKindOrThrow(SyntaxKind.FunctionExpression).getParameters();
            paramName = ps[0]?.getName();
          }

          const keyExpr =
            paramName && /^[A-Za-z_$][\w$]*$/.test(paramName)
              ? `{String(${paramName}.id ?? ${paramName}.key ?? JSON.stringify(${paramName}))}`
              : `{String(Math.random())}`;

          opening.addAttribute({ name: "key", initializer: keyExpr });
          return true;
        }
      }
      cur = cur.getParent();
    }
  }

  return false;
}

export function applyAutofixesForViolations(sf: SourceFile, violations: RuleViolation[]): { fixed: number } {
  let fixed = 0;

  for (const v of violations) {
    if (v.file !== sf.getFilePath()) continue;

    if (v.rule === "no-hardcoded-hex") {
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.StringLiteral) return;
        const lit = node as StringLiteral;
        if (lit.getStartLineNumber() !== v.line) return;
        const raw = lit.getLiteralValue();
        if (!/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(raw)) return;

        // Deterministic token swap: remove hex tokens; prefer semantic background token for common whites.
        let next = raw;
        next = replaceAllCaseInsensitive(next, "#ffffff", "bg-background");
        next = replaceAllCaseInsensitive(next, "#fff", "bg-background");
        next = replaceAllCaseInsensitive(next, "#000000", "bg-foreground");
        next = replaceAllCaseInsensitive(next, "#000", "bg-foreground");

        // Generic: strip remaining hex tokens by replacing with bg-muted (safe-ish fallback).
        next = next.replace(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/gi, "bg-muted");

        if (next !== raw) {
          lit.setLiteralValue(next);
          fixed += 1;
        }
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
        const next = raw.replace(/z-\[[^\]]+\]/g, "z-50");
        if (next !== raw) {
          lit.setLiteralValue(next);
          fixed += 1;
        }
      });
      continue;
    }

    if (v.rule === "no-missing-react-keys") {
      if (tryFixMissingReactKeyFromMap(sf, v.line)) fixed += 1;
    }
  }

  return { fixed };
}
