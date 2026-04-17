import fs from "node:fs/promises";
import path from "node:path";

import { createSharinganProject } from "../ast/sharingan.js";
import { loadCustomRuleModules, runCustomRules } from "./custom-rules.js";
import { runDeterministicRulesWithContext } from "./deterministic.js";
import { buildDefaultRuleRuntimeContext, shouldIgnoreFile, type RuleRuntimeContext } from "./rule-loader.js";
import { POLYGLOT_VALIDATE_PATH } from "./polyglot-extensions.js";
import { scanPolyglotFile } from "./polyglot-rules.js";
import type { RuleViolation } from "./violation-types.js";

function mapSeverity(v: RuleViolation, ctx: RuleRuntimeContext): RuleViolation {
  const st = ctx.states.get(v.rule);
  const sev = st?.severity ?? v.severity;
  return {
    ...v,
    severity: sev === "info" ? "info" : sev === "error" ? "error" : "warning",
  };
}

export async function collectAllDeterministicViolations(
  cwd: string,
  absFiles: string[],
  ruleContext?: RuleRuntimeContext
): Promise<RuleViolation[]> {
  const ctx = ruleContext ?? (await buildDefaultRuleRuntimeContext(cwd));
  const tsJs = absFiles.filter((f) => /\.(tsx?|jsx?)$/i.test(f));
  const poly = absFiles.filter((f) => POLYGLOT_VALIDATE_PATH.test(f));

  const out: RuleViolation[] = [];

  if (tsJs.length) {
    const sharingan = createSharinganProject(cwd);
    const sourceFiles = sharingan.addSourceFiles(tsJs);
    for (const sf of sourceFiles) {
      out.push(...runDeterministicRulesWithContext(sf, ctx));
    }
  }

  const enabled = (id: string) => {
    const st = ctx.states.get(id);
    return st?.enabled ?? false;
  };

  for (const file of poly) {
    const rel = path.relative(cwd, file).replace(/\\/g, "/");
    if (shouldIgnoreFile(rel, ctx.ignorePatterns)) continue;
    let text: string;
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    for (const v of scanPolyglotFile(file, text, enabled)) {
      out.push(mapSeverity(v, ctx));
    }
  }

  const mods = await loadCustomRuleModules(cwd);
  const custom = await runCustomRules(cwd, absFiles, mods);
  for (const v of custom) {
    out.push(mapSeverity(v, ctx));
  }

  return out;
}

export function partitionFilesByKind(absFiles: string[]): { tsJs: string[]; polyglot: string[]; other: string[] } {
  const tsJs: string[] = [];
  const polyglot: string[] = [];
  const other: string[] = [];
  for (const f of absFiles) {
    if (/\.(tsx?|jsx?)$/i.test(f)) tsJs.push(f);
    else if (POLYGLOT_VALIDATE_PATH.test(f)) polyglot.push(f);
    else other.push(f);
  }
  return { tsJs, polyglot, other };
}
