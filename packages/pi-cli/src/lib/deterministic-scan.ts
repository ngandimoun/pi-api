import path from "node:path";

import { createSharinganProject } from "./ast/sharingan.js";
import { getChangedFiles, getPendingChanges } from "./vcs/index.js";
import { runDeterministicRulesWithContext, type RuleViolation } from "./rules/deterministic.js";
import { buildDefaultRuleRuntimeContext, type RuleRuntimeContext } from "./rules/rule-loader.js";

const TS_JS = /\.(tsx|ts|jsx|js)$/;

/** Absolute paths of TS/JS files to scan for a validate/fix run. */
export async function listChangedTsJsFiles(
  cwd: string,
  since: "staged" | "head",
  paths?: string[]
): Promise<string[]> {
  if (paths?.length) {
    return paths.map((p) => path.resolve(cwd, p));
  }
  if (since === "staged") {
    return (await getPendingChanges(cwd))
      .map((f) => path.resolve(cwd, f))
      .filter((f) => TS_JS.test(f));
  }
  const rel = await getChangedFiles(cwd, "HEAD");
  return rel.map((f) => path.resolve(cwd, f)).filter((f) => TS_JS.test(f));
}

/** Run Sharingan + deterministic rules (no API, no cache). */
export async function collectDeterministicViolationsForFiles(
  cwd: string,
  absFiles: string[],
  ruleContext?: RuleRuntimeContext
): Promise<RuleViolation[]> {
  if (!absFiles.length) return [];
  const ctx = ruleContext ?? (await buildDefaultRuleRuntimeContext(cwd));
  const sharingan = createSharinganProject(cwd);
  const sourceFiles = sharingan.addSourceFiles(absFiles);
  const out: RuleViolation[] = [];
  for (const sf of sourceFiles) {
    out.push(...runDeterministicRulesWithContext(sf, ctx));
  }
  return out;
}
