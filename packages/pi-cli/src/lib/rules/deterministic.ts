import path from "node:path";
import type { SourceFile } from "ts-morph";

import { runTsMorphRuleSet, TS_MORPH_RULE_RUNNERS } from "./ts-morph-rules.js";
import {
  ruleNoHardcodedHex,
  ruleNoMissingReactKeys,
  ruleNoZIndexChaos,
} from "./tailwind-style-rules.js";
import type { RuleRuntimeContext } from "./rule-loader.js";
import { shouldIgnoreFile } from "./rule-loader.js";
import type { RuleViolation } from "./violation-types.js";

export type { RuleViolation } from "./violation-types.js";

export { ruleNoHardcodedHex, ruleNoZIndexChaos, ruleNoMissingReactKeys };

function defaultMapSeverity(v: RuleViolation): RuleViolation {
  return v;
}

/** Run all local ts-morph rules. Pass `ruleContext` from `buildDefaultRuleRuntimeContext(cwd)` for `.pi/rules.json`. */
export function runDeterministicRules(
  sf: SourceFile,
  enabledRuleIds?: Set<string>,
  ruleContext?: RuleRuntimeContext
): RuleViolation[] {
  if (ruleContext) {
    return runDeterministicRulesWithContext(sf, ruleContext, enabledRuleIds);
  }
  // Fallback: enable all catalog rules that have runners (no file-based config in sync path)
  const enabled = (id: string) =>
    (!enabledRuleIds || enabledRuleIds.has(id)) && TS_MORPH_RULE_RUNNERS.some((r) => r.id === id);
  return runTsMorphRuleSet(sf, {
    enabled,
    mapSeverity: defaultMapSeverity,
  });
}

export function runDeterministicRulesWithContext(
  sf: SourceFile,
  ctx: RuleRuntimeContext,
  enabledRuleIds?: Set<string>
): RuleViolation[] {
  const rel = path.relative(ctx.cwd, sf.getFilePath()).replace(/\\/g, "/");
  if (shouldIgnoreFile(rel, ctx.ignorePatterns)) return [];

  const enabled = (id: string) => {
    if (enabledRuleIds && !enabledRuleIds.has(id)) return false;
    const st = ctx.states.get(id);
    if (!st?.enabled) return false;
    return true;
  };

  const mapSeverity = (v: RuleViolation, ruleId: string): RuleViolation => {
    const st = ctx.states.get(ruleId);
    const sev = st?.severity ?? v.severity;
    return { ...v, severity: sev === "info" ? "info" : sev === "error" ? "error" : "warning" };
  };

  return runTsMorphRuleSet(sf, { enabled, mapSeverity });
}
