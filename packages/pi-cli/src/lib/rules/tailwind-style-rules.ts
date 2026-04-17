import {
  Node,
  SourceFile,
  SyntaxKind,
  type StringLiteral,
} from "ts-morph";

import type { RuleViolation } from "./violation-types.js";

const HEX_IN_CLASS = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/;
const Z_INDEX_CHAOS = /z-\[(?:[0-9]{3,}|[89][0-9]{3,})\]|z-\[9999\]/;
const TAILWIND_Z_HIGH = /\bz-\[(?:[1-9][0-9]{2,}|[0-9]{4,})\]/;

function lineAndColumn(sf: SourceFile, pos: number): { line: number; column: number } {
  const lc = sf.getLineAndColumnAtPos(pos);
  return { line: lc.line, column: lc.column };
}

function isLikelyStyleString(node: StringLiteral): boolean {
  let p: Node | undefined = node.getParent();
  while (p) {
    const t = p.getText();
    if (
      p.getKind() === SyntaxKind.JsxAttribute &&
      /^\s*className\s*=/.test(t)
    ) {
      return true;
    }
    if (p.getKind() === SyntaxKind.CallExpression) {
      const expr = p.asKind(SyntaxKind.CallExpression)?.getExpression().getText() ?? "";
      if (/^(cn|clsx|cva|twMerge|classNames)$/.test(expr)) {
        return true;
      }
    }
    p = p.getParent();
  }
  return false;
}

/** Rule: hardcoded hex inside className / cn() string literals */
export function ruleNoHardcodedHex(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const ext = sf.getFilePath().split(".").pop()?.toLowerCase();
  if (ext !== "tsx" && ext !== "jsx") return out;

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.StringLiteral) return;
    const lit = node as StringLiteral;
    const text = lit.getLiteralValue();
    if (!HEX_IN_CLASS.test(text)) return;
    if (!isLikelyStyleString(lit)) return;
    const { line, column } = lineAndColumn(sf, lit.getStart());
    out.push({
      rule: "no-hardcoded-hex",
      severity: "warning",
      message: "Avoid hardcoded hex in Tailwind/class strings; use design tokens or theme colors.",
      file: sf.getFilePath(),
      line,
      column,
      suggestion: "Replace with semantic tokens (e.g. bg-primary) or Tailwind palette classes.",
    });
  });
  return out;
}

/** Rule: absurd z-index utilities */
export function ruleNoZIndexChaos(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const ext = sf.getFilePath().split(".").pop()?.toLowerCase();
  if (ext !== "tsx" && ext !== "jsx") return out;

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.StringLiteral) return;
    const lit = node as StringLiteral;
    const text = lit.getLiteralValue();
    if (!(Z_INDEX_CHAOS.test(text) || TAILWIND_Z_HIGH.test(text))) return;
    if (!isLikelyStyleString(lit)) return;
    const { line, column } = lineAndColumn(sf, lit.getStart());
    out.push({
      rule: "no-z-index-chaos",
      severity: "warning",
      message: "Avoid extreme arbitrary z-index; use a small fixed scale (z-10, z-20, z-50).",
      file: sf.getFilePath(),
      line,
      column,
    });
  });
  return out;
}

function unwrapJsxBody(body: Node): Node | undefined {
  let b: Node | undefined = body;
  if (b.getKind() === SyntaxKind.Block) {
    const stmts = b.asKindOrThrow(SyntaxKind.Block).getStatements();
    if (stmts.length !== 1) return undefined;
    const st = stmts[0];
    if (st.getKind() !== SyntaxKind.ReturnStatement) return undefined;
    const ret = st.asKindOrThrow(SyntaxKind.ReturnStatement).getExpression();
    if (!ret) return undefined;
    b = ret;
  }
  if (b.getKind() === SyntaxKind.ParenthesizedExpression) {
    b = b.getFirstChild();
  }
  return b;
}

/** Rule: .map( => JSX) without key on top-level JSX element */
export function ruleNoMissingReactKeys(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const ext = sf.getFilePath().split(".").pop()?.toLowerCase();
  if (ext !== "tsx" && ext !== "jsx") return out;

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const call = node.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression();
    if (!expr.getText().endsWith(".map")) return;
    const args = call.getArguments();
    const cb = args[0];
    if (!cb) return;
    let body: Node | undefined;
    if (cb.getKind() === SyntaxKind.ArrowFunction) {
      const arrow = cb.asKindOrThrow(SyntaxKind.ArrowFunction);
      body = arrow.getBody();
    } else if (cb.getKind() === SyntaxKind.FunctionExpression) {
      body = cb.asKindOrThrow(SyntaxKind.FunctionExpression).getBody();
    } else {
      return;
    }
    if (!body) return;
    const jsx = unwrapJsxBody(body);
    if (!jsx) return;
    if (
      jsx.getKind() !== SyntaxKind.JsxElement &&
      jsx.getKind() !== SyntaxKind.JsxSelfClosingElement
    ) {
      return;
    }
    const opening =
      jsx.getKind() === SyntaxKind.JsxElement
        ? jsx.asKindOrThrow(SyntaxKind.JsxElement).getOpeningElement()
        : jsx.asKindOrThrow(SyntaxKind.JsxSelfClosingElement);
    const hasKey = opening.getAttributes().some((a) => {
      if (a.getKind() !== SyntaxKind.JsxAttribute) return false;
      const nameText = a.asKindOrThrow(SyntaxKind.JsxAttribute).getNameNode().getText();
      return nameText === "key";
    });
    if (!hasKey) {
      const { line, column } = lineAndColumn(sf, opening.getStart());
      out.push({
        rule: "no-missing-react-keys",
        severity: "error",
        message: "List render via .map should set a stable key on the outer JSX element.",
        file: sf.getFilePath(),
        line,
        column,
        suggestion: 'Add key={"..."} or key={item.id} to the element returned from .map.',
      });
    }
  });
  return out;
}
