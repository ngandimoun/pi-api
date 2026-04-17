import { z } from "zod";

/** Severity for a rule finding */
export const ruleSeveritySchema = z.enum(["error", "warning", "info"]);

/** How the rule is evaluated */
export const ruleTierSchema = z.enum(["deterministic", "spec", "semantic"]);

export const ruleCategorySchema = z.enum([
  "frontend",
  "backend",
  "security",
  "performance",
  "a11y",
  "semantic",
]);

/** Optional AST pattern metadata (documentation / future dynamic engine) */
export const astPatternSchema = z.object({
  nodeType: z.string(),
  condition: z.string().optional(),
  message: z.string(),
  suggestion: z.string().optional(),
});

export const ruleDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  category: ruleCategorySchema,
  tier: ruleTierSchema,
  severity: ruleSeveritySchema.default("warning"),
  languages: z.array(z.string()).default(["typescript", "javascript"]),
  filePatterns: z.array(z.string()).default(["**/*.{ts,tsx,js,jsx}"]),
  enabled: z.boolean().default(true),
  autofix: z.boolean().default(false),
  /** When true, local CLI returns no findings; cloud API handles validation */
  localStub: z.boolean().default(false),
  cloudEndpoint: z.string().optional(),
  astPatterns: z.array(astPatternSchema).optional(),
  specConfig: z
    .object({
      endpoint: z.string().optional(),
      contextRequired: z.array(z.string()).optional(),
    })
    .optional(),
});

export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;

/** Project-level overrides in `.pi/rules.json` */
export const projectRuleEntrySchema = z.union([
  z.literal("off"),
  z.literal("warn"),
  z.literal("error"),
  z.literal("warning"),
  z.object({
    severity: ruleSeveritySchema.optional(),
    enabled: z.boolean().optional(),
  }),
]);

export const projectRulesConfigSchema = z.object({
  extends: z.array(z.string()).optional(),
  rules: z.record(z.string(), projectRuleEntrySchema).optional(),
  ignorePatterns: z.array(z.string()).optional(),
});

export type ProjectRulesConfig = z.infer<typeof projectRulesConfigSchema>;
export type ProjectRuleEntry = z.infer<typeof projectRuleEntrySchema>;

export type ResolvedRuleState = {
  id: string;
  enabled: boolean;
  severity: "error" | "warning" | "info";
};
