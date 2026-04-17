export type RuleViolation = {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  file: string;
  line: number;
  column: number;
  suggestion?: string;
};
