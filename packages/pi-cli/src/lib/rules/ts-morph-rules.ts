/**
 * Extended deterministic rules for TypeScript / JavaScript (ts-morph).
 * Spec-tier rules here use local heuristics only; full analysis may be cloud-backed.
 */
import {
  Node,
  SourceFile,
  SyntaxKind,
  type StringLiteral,
} from "ts-morph";

import type { RuleViolation } from "./violation-types.js";
import {
  ruleNoHardcodedHex,
  ruleNoMissingReactKeys,
  ruleNoZIndexChaos,
} from "./tailwind-style-rules.js";

const MAGIC_DIM =
  /\b(?:min-|max-)?[wh]-\[\d{2,}px\]|\b(?:min-|max-)?[whxy]-\[\d{3,}px\]|(?:^|\s)(?:w|h|min-w|min-h|max-w|max-h)-\[\d+px\]/;
const HTTP_URL =
  /https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)([\w.-]+)(?::\d+)?(?:\/[\w./?#-]*)?/;
const HTTP_LOCALHOST = /https?:\/\/(?:localhost|127\.0\.0\.1)/;
const SECRET_PATTERNS = [
  /\bsk_live_[a-zA-Z0-9]{20,}/,
  /\bsk_test_[a-zA-Z0-9]{20,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
  /\bghp_[a-zA-Z0-9]{20,}\b/,
  /\bgho_[a-zA-Z0-9]{20,}\b/,
];

function lc(sf: SourceFile, pos: number) {
  const x = sf.getLineAndColumnAtPos(pos);
  return { line: x.line, column: x.column };
}

function isLikelyStyleString(node: StringLiteral): boolean {
  let p: Node | undefined = node.getParent();
  while (p) {
    const t = p.getText();
    if (p.getKind() === SyntaxKind.JsxAttribute && /^\s*className\s*=/.test(t)) return true;
    if (p.getKind() === SyntaxKind.CallExpression) {
      const expr = p.asKind(SyntaxKind.CallExpression)?.getExpression().getText() ?? "";
      if (/^(cn|clsx|cva|twMerge|classNames)$/.test(expr)) return true;
    }
    p = p.getParent();
  }
  return false;
}

export function ruleNoMagicDimensions(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const ext = sf.getFilePath().split(".").pop()?.toLowerCase();
  if (ext !== "tsx" && ext !== "jsx") return out;
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.StringLiteral) return;
    const lit = node as StringLiteral;
    const text = lit.getLiteralValue();
    if (!MAGIC_DIM.test(text)) return;
    if (!isLikelyStyleString(lit)) return;
    const { line, column } = lc(sf, lit.getStart());
    out.push({
      rule: "no-magic-dimensions",
      severity: "warning",
      message: "Avoid arbitrary pixel dimensions in utilities; prefer spacing scale or tokens.",
      file: sf.getFilePath(),
      line,
      column,
      suggestion: "Use Tailwind spacing (e.g. w-80) or design tokens instead of arbitrary px.",
    });
  });
  return out;
}

export function ruleNoInlineStyleObject(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const ext = sf.getFilePath().split(".").pop()?.toLowerCase();
  if (ext !== "tsx" && ext !== "jsx") return out;
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.JsxAttribute) return;
    const attr = node.asKindOrThrow(SyntaxKind.JsxAttribute);
    const name = attr.getNameNode().getText();
    if (name !== "style") return;
    const init = attr.getInitializer();
    if (!init || init.getKind() !== SyntaxKind.JsxExpression) return;
    const expr = init.asKindOrThrow(SyntaxKind.JsxExpression).getExpression();
    if (!expr || expr.getKind() !== SyntaxKind.ObjectLiteralExpression) return;
    const { line, column } = lc(sf, attr.getStart());
    out.push({
      rule: "no-inline-style-object",
      severity: "warning",
      message: "Prefer Tailwind/CSS modules over inline style={{…}} when possible.",
      file: sf.getFilePath(),
      line,
      column,
    });
  });
  return out;
}

export function ruleNoDirectDomAccess(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const call = node.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression().getText();
    if (
      /^(document\.(getElementById|querySelector|querySelectorAll)|window\.document)/.test(
        expr
      ) ||
      /^document\.(getElementById|querySelector)/.test(expr)
    ) {
      const { line, column } = lc(sf, call.getStart());
      out.push({
        rule: "no-direct-dom-access",
        severity: "warning",
        message: "Avoid direct DOM queries in React; prefer refs or declarative patterns.",
        file: sf.getFilePath(),
        line,
        column,
      });
    }
  });
  return out;
}

export function ruleNoExplicitAny(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const fp = sf.getFilePath();
  if (!/\.tsx?$/.test(fp)) return out;
  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.AnyKeyword) {
      const { line, column } = lc(sf, node.getStart());
      out.push({
        rule: "no-explicit-any",
        severity: "warning",
        message: "Avoid explicit `any`; use `unknown` or a narrower type.",
        file: fp,
        line,
        column,
      });
    }
    if (node.getKind() === SyntaxKind.AsExpression) {
      const t = node.asKindOrThrow(SyntaxKind.AsExpression).getTypeNode()?.getText();
      if (t === "any") {
        const { line, column } = lc(sf, node.getStart());
        out.push({
          rule: "no-explicit-any",
          severity: "warning",
          message: "Avoid `as any`; narrow the type safely.",
          file: fp,
          line,
          column,
        });
      }
    }
  });
  return out;
}

export function ruleNoUnhandledPromise(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const fp = sf.getFilePath().replace(/\\/g, "/");
  if (/(?:\.test\.|\.spec\.|__tests__|\/e2e\/)/i.test(fp)) return out;
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.ExpressionStatement) return;
    const est = node.asKindOrThrow(SyntaxKind.ExpressionStatement);
    const expr = est.getExpression();
    if (expr.getKind() !== SyntaxKind.CallExpression) return;
    const call = expr.asKindOrThrow(SyntaxKind.CallExpression);
    const callee = call.getExpression();
    if (callee.getKind() === SyntaxKind.Identifier && callee.getText() === "fetch") {
      const { line, column } = lc(sf, call.getStart());
      out.push({
        rule: "no-unhandled-promise",
        severity: "warning",
        message: "Top-level fetch() should be awaited, voided, or chained with .catch().",
        file: sf.getFilePath(),
        line,
        column,
      });
    }
  });
  return out;
}

export function ruleNoHardcodedHttpUrl(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const full = sf.getFullText();
  const skipLine = (line: string) =>
    /process\.env|import\.meta\.env|NEXT_PUBLIC_|VITE_|Deno\.env/.test(line);

  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.StringLiteral) {
      const lit = node as StringLiteral;
      const v = lit.getLiteralValue();
      const lineText = lit.getStartLineNumber();
      const lines = full.split("\n");
      const line = lines[lineText - 1] ?? "";
      if (skipLine(line)) return;
      if (HTTP_URL.test(v) || HTTP_LOCALHOST.test(v)) {
        const pos = lc(sf, lit.getStart());
        out.push({
          rule: "no-hardcoded-http-url",
          severity: "warning",
          message: "Move URLs to environment variables or a config module.",
          file: sf.getFilePath(),
          line: pos.line,
          column: pos.column,
        });
      }
    }
  });
  return out;
}

export function ruleNoConsoleLog(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const fp = sf.getFilePath().replace(/\\/g, "/");
  if (/(?:\.test\.|\.spec\.|__tests__|\/e2e\/|\/fixtures\/)/i.test(fp)) return out;

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const call = node.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression().getText();
    if (/^console\.(log|debug|info|trace)$/.test(expr)) {
      const { line, column } = lc(sf, call.getStart());
      out.push({
        rule: "no-console-log",
        severity: "warning",
        message: "Remove or gate debug console calls before shipping.",
        file: sf.getFilePath(),
        line,
        column,
      });
    }
  });
  return out;
}

function isAppRouterPage(fp: string): boolean {
  const n = fp.replace(/\\/g, "/");
  return /\/app\/.*\/page\.(tsx|jsx)$/.test(n);
}

export function ruleRequireSeoMetadata(sf: SourceFile): RuleViolation[] {
  const fp = sf.getFilePath();
  if (!isAppRouterPage(fp)) return [];
  const text = sf.getFullText();
  if (/export\s+const\s+metadata\b/.test(text) || /export\s+async\s+function\s+generateMetadata\b/.test(text))
    return [];
  const { line, column } = lc(sf, 0);
  return [
    {
      rule: "require-seo-metadata",
      severity: "warning",
      message: "App Router page should export `metadata` or `generateMetadata` for SEO.",
      file: fp,
      line,
      column,
    },
  ];
}

export function ruleA11yImages(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const ext = sf.getFilePath().split(".").pop()?.toLowerCase();
  if (ext !== "tsx" && ext !== "jsx") return out;
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.JsxSelfClosingElement) return;
    const el = node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement);
    const tag = el.getTagNameNode().getText();
    if (tag !== "img") return;
    const hasAlt = el.getAttributes().some((a) => {
      if (a.getKind() !== SyntaxKind.JsxAttribute) return false;
      return a.asKindOrThrow(SyntaxKind.JsxAttribute).getNameNode().getText() === "alt";
    });
    if (!hasAlt) {
      const { line, column } = lc(sf, el.getStart());
      out.push({
        rule: "a11y-images",
        severity: "warning",
        message: '<img> should include an alt attribute (use alt="" for decorative images).',
        file: sf.getFilePath(),
        line,
        column,
      });
    }
  });
  return out;
}

export function ruleClientServerBoundary(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const text = sf.getFullText();
  if (!/^["']use client["'];/m.test(text)) return out;
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.ImportDeclaration) return;
    const mod = node.asKindOrThrow(SyntaxKind.ImportDeclaration).getModuleSpecifierValue();
    if (mod === "server-only" || mod === "fs" || mod === "node:fs" || mod.startsWith("node:")) {
      const { line, column } = lc(sf, node.getStart());
      out.push({
        rule: "client-server-boundary",
        severity: "error",
        message: `"use client" module must not import server-only or Node built-ins (${mod}).`,
        file: sf.getFilePath(),
        line,
        column,
      });
    }
  });
  return out;
}

export function ruleRequireSuspenseAsync(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  if (!isAppRouterPage(sf.getFilePath())) return out;
  const text = sf.getFullText();
  if (!/export\s+default\s+async\s+function/.test(text)) return out;
  if (/Suspense/.test(text)) return out;
  const { line, column } = lc(sf, 0);
  return [
    {
      rule: "require-suspense-async",
      severity: "warning",
      message: "Async server page may need a Suspense boundary or loading.tsx for streaming UX.",
      file: sf.getFilePath(),
      line,
      column,
    },
  ];
}

export function ruleFormValidationZod(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const ext = sf.getFilePath().split(".").pop()?.toLowerCase();
  if (ext !== "tsx" && ext !== "jsx") return out;
  const text = sf.getFullText();
  if (!/<form[\s>]/.test(text)) return out;
  if (/z\.object|safeParse|parse\(|@hookform\/resolvers|valibot|yup/.test(text)) return out;
  const { line, column } = lc(sf, 0);
  return [
    {
      rule: "form-validation-zod",
      severity: "warning",
      message: "Forms should validate input with a schema (e.g. Zod) before submit.",
      file: sf.getFilePath(),
      line,
      column,
    },
  ];
}

function isApiRouteFile(fp: string): boolean {
  const n = fp.replace(/\\/g, "/");
  return /\/app\/api\/.*\/route\.(ts|js)$/.test(n) || /\/pages\/api\//.test(n);
}

export function ruleRequireAuthGuard(sf: SourceFile): RuleViolation[] {
  const fp = sf.getFilePath();
  if (!isApiRouteFile(fp)) return [];
  const text = sf.getFullText();
  if (!/\b(?:GET|POST|PUT|PATCH|DELETE)\b/.test(text)) return [];
  if (
    /getServerSession|auth\(|withAuth|requireAuth|getSession|verifySession|unstable_getServerSession|createRouteHandlerClient/.test(
      text
    )
  )
    return [];
  const { line, column } = lc(sf, 0);
  return [
    {
      rule: "require-auth-guard",
      severity: "warning",
      message: "API route should verify authentication/session before handling sensitive work.",
      file: fp,
      line,
      column,
    },
  ];
}

export function ruleNoSqlInjectionPattern(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  const text = sf.getFullText();
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.TaggedTemplateExpression) return;
    const tag = node.asKindOrThrow(SyntaxKind.TaggedTemplateExpression).getTag().getText();
    if (!/^(sql|raw|unsafe)/i.test(tag)) return;
    const tpl = node.asKindOrThrow(SyntaxKind.TaggedTemplateExpression).getTemplate();
    if (tpl.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) return;
    const { line, column } = lc(sf, node.getStart());
    out.push({
      rule: "no-sql-injection-pattern",
      severity: "error",
      message: "Avoid string interpolation inside SQL template literals; use parameterized queries.",
      file: sf.getFilePath(),
      line,
      column,
    });
  });
  if (/\$\{[^}]+\}/.test(text) && /\bprisma\.\$queryRaw\s*\(/.test(text)) {
    const { line, column } = lc(sf, 0);
    out.push({
      rule: "no-sql-injection-pattern",
      severity: "error",
      message: "Prefer Prisma tagged templates or bound parameters instead of dynamic raw SQL strings.",
      file: sf.getFilePath(),
      line,
      column,
    });
  }
  return out;
}

export function ruleNoHardcodedSecretTs(sf: SourceFile): RuleViolation[] {
  const out: RuleViolation[] = [];
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.StringLiteral) return;
    const lit = node as StringLiteral;
    const v = lit.getLiteralValue();
    if (SECRET_PATTERNS.some((re) => re.test(v))) {
      const { line, column } = lc(sf, lit.getStart());
      out.push({
        rule: "no-hardcoded-secret",
        severity: "error",
        message: "Possible secret/API token in source; move to environment variables.",
        file: sf.getFilePath(),
        line,
        column,
      });
    }
  });
  return out;
}

export function ruleRequireRateLimitPublic(sf: SourceFile): RuleViolation[] {
  const fp = sf.getFilePath();
  if (!isApiRouteFile(fp)) return [];
  const text = sf.getFullText();
  if (!/export\s+async\s+function\s+POST\b/.test(text)) return [];
  if (/rateLimit|ratelimit|upstash|@upstash\/ratelimit|slowDown/.test(text)) return [];
  const { line, column } = lc(sf, 0);
  return [
    {
      rule: "require-rate-limit-public",
      severity: "warning",
      message: "Public POST handlers should implement rate limiting for abuse protection.",
      file: fp,
      line,
      column,
    },
  ];
}

export function ruleRequireInputValidation(sf: SourceFile): RuleViolation[] {
  const fp = sf.getFilePath();
  if (!isApiRouteFile(fp)) return [];
  const text = sf.getFullText();
  if (!/POST|PUT|PATCH/.test(text)) return [];
  if (/safeParse|\.parse\(|schema|zod|valibot|typebox/i.test(text)) return [];
  const { line, column } = lc(sf, 0);
  return [
    {
      rule: "require-input-validation",
      severity: "warning",
      message: "API route should validate request body/query with a schema parser.",
      file: fp,
      line,
      column,
    },
  ];
}

export function ruleRequireApiErrorHandling(sf: SourceFile): RuleViolation[] {
  const fp = sf.getFilePath();
  if (!isApiRouteFile(fp)) return [];
  const text = sf.getFullText();
  if (!/await\s+(?:prisma|db\.|getServerSession|stripe\.)/i.test(text)) return [];
  if (/\btry\s*\{/.test(text)) return [];
  const { line, column } = lc(sf, 0);
  return [
    {
      rule: "require-api-error-handling",
      severity: "warning",
      message: "Route handler with awaited I/O should use try/catch for predictable error responses.",
      file: fp,
      line,
      column,
    },
  ];
}

export function ruleWebhookSignature(sf: SourceFile): RuleViolation[] {
  const fp = sf.getFilePath().replace(/\\/g, "/").toLowerCase();
  if (!/(webhook|stripe|clerk)/.test(fp)) return [];
  const text = sf.getFullText();
  if (/constructEvent|verifySignature|timingSafeEqual|svix|webhook.*secret/i.test(text)) return [];
  const { line, column } = lc(sf, 0);
  return [
    {
      rule: "webhook-signature",
      severity: "warning",
      message: "Webhook route should verify provider signatures (e.g. Stripe constructEvent).",
      file: sf.getFilePath(),
      line,
      column,
    },
  ];
}

/** Spec rules with no local heuristic yet — empty (cloud handles). */
export function ruleStubEmpty(): RuleViolation[] {
  return [];
}

export type TsMorphRuleFn = (sf: SourceFile) => RuleViolation[];

export const TS_MORPH_RULE_RUNNERS: { id: string; run: TsMorphRuleFn }[] = [
  { id: "no-hardcoded-hex", run: ruleNoHardcodedHex },
  { id: "no-z-index-chaos", run: ruleNoZIndexChaos },
  { id: "no-magic-dimensions", run: ruleNoMagicDimensions },
  { id: "no-inline-style-object", run: ruleNoInlineStyleObject },
  { id: "no-missing-react-keys", run: ruleNoMissingReactKeys },
  { id: "no-direct-dom-access", run: ruleNoDirectDomAccess },
  { id: "no-explicit-any", run: ruleNoExplicitAny },
  { id: "no-unhandled-promise", run: ruleNoUnhandledPromise },
  { id: "no-hardcoded-http-url", run: ruleNoHardcodedHttpUrl },
  { id: "no-console-log", run: ruleNoConsoleLog },
  { id: "require-suspense-async", run: ruleRequireSuspenseAsync },
  { id: "require-error-boundary", run: ruleStubEmpty },
  { id: "require-loading-state", run: ruleStubEmpty },
  { id: "require-empty-state", run: ruleStubEmpty },
  { id: "client-server-boundary", run: ruleClientServerBoundary },
  { id: "require-seo-metadata", run: ruleRequireSeoMetadata },
  { id: "a11y-images", run: ruleA11yImages },
  { id: "form-validation-zod", run: ruleFormValidationZod },
  { id: "i18n-no-hardcoded-copy", run: ruleStubEmpty },
  { id: "responsive-breakpoints", run: ruleStubEmpty },
  { id: "ux-copy-tone", run: ruleStubEmpty },
  { id: "component-structure-consistency", run: ruleStubEmpty },
  { id: "animation-ux", run: ruleStubEmpty },
  { id: "navigation-ia", run: ruleStubEmpty },
  { id: "require-auth-guard", run: ruleRequireAuthGuard },
  { id: "no-sql-injection-pattern", run: ruleNoSqlInjectionPattern },
  { id: "no-hardcoded-secret", run: ruleNoHardcodedSecretTs },
  { id: "require-rate-limit-public", run: ruleRequireRateLimitPublic },
  { id: "require-input-validation", run: ruleRequireInputValidation },
  { id: "require-api-error-handling", run: ruleRequireApiErrorHandling },
  { id: "no-n-plus-one", run: ruleStubEmpty },
  { id: "require-db-index-hint", run: ruleStubEmpty },
  { id: "require-transaction", run: ruleStubEmpty },
  { id: "cache-invalidation", run: ruleStubEmpty },
  { id: "webhook-signature", run: ruleWebhookSignature },
  { id: "cors-configuration", run: ruleStubEmpty },
  { id: "layering-business-logic", run: ruleStubEmpty },
  { id: "rest-naming", run: ruleStubEmpty },
  { id: "function-complexity", run: ruleStubEmpty },
  { id: "require-jsdoc-complex", run: ruleStubEmpty },
];

export function runTsMorphRuleSet(
  sf: SourceFile,
  opts: {
    enabled: (ruleId: string) => boolean;
    mapSeverity: (v: RuleViolation, ruleId: string) => RuleViolation;
  }
): RuleViolation[] {
  const out: RuleViolation[] = [];
  for (const { id, run } of TS_MORPH_RULE_RUNNERS) {
    if (!opts.enabled(id)) continue;
    for (const v of run(sf)) {
      if (v.rule !== id) continue;
      out.push(opts.mapSeverity(v, id));
    }
  }
  return out;
}
