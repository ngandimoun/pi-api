export type RuleSeverity = "error" | "warning";

export type RuleViolation = {
  rule_id: string;
  severity: RuleSeverity;
  message: string;
  file: string;
  line: number;
  column: number;
  suggestion?: string;
  cost_tier: "deterministic" | "spec" | "semantic";
};
