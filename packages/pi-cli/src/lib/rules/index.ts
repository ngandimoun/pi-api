export { RULE_IDS, type RuleId } from "./registry.js";
export type { RuleViolation } from "./violation-types.js";
export type { RuleDefinition, ProjectRulesConfig, ProjectRuleEntry, ResolvedRuleState } from "./rule-schema.js";
export {
  loadBuiltInRuleDefinitions,
  loadProjectRulesConfig,
  resolveRuleStates,
  shouldIgnoreFile,
  buildRuleRuntimeContext,
  buildDefaultRuleRuntimeContext,
  type RuleRuntimeContext,
} from "./rule-loader.js";
export {
  runDeterministicRules,
  runDeterministicRulesWithContext,
  ruleNoHardcodedHex,
  ruleNoZIndexChaos,
  ruleNoMissingReactKeys,
} from "./deterministic.js";
export { collectAllDeterministicViolations } from "./rule-executor.js";
export {
  defineRule,
  loadCustomRuleModules,
  runCustomRules,
  type PiCustomRuleModule,
} from "./custom-rules.js";
export {
  generateDeterministicPatches,
  filterViolationsByPatchConfidence,
  type DeterministicPatch,
} from "./patch-generator.js";
