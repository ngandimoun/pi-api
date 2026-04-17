import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  projectRulesConfigSchema,
  ruleDefinitionSchema,
  type ProjectRuleEntry,
  type ProjectRulesConfig,
  type ResolvedRuleState,
  type RuleDefinition,
} from "./rule-schema.js";

const builtInUrl = new URL("./definitions/built-in.json", import.meta.url);

function normalizeSeverity(entry: ProjectRuleEntry | undefined): "error" | "warning" | "info" | "off" | undefined {
  if (entry === "off") return "off";
  if (entry === "error") return "error";
  if (entry === "warn" || entry === "warning") return "warning";
  if (typeof entry === "object" && entry) {
    if (entry.enabled === false) return "off";
    return entry.severity;
  }
  return undefined;
}

/** Load bundled built-in rule catalog */
export async function loadBuiltInRuleDefinitions(): Promise<RuleDefinition[]> {
  const raw = await fs.readFile(fileURLToPath(builtInUrl), "utf8");
  const arr = JSON.parse(raw) as unknown[];
  return arr.map((x) => ruleDefinitionSchema.parse(x));
}

/** Load optional `.pi/rules.json` from project root */
export async function loadProjectRulesConfig(cwd: string): Promise<ProjectRulesConfig | null> {
  const p = path.join(cwd, ".pi", "rules.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    return projectRulesConfigSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Merge built-in definitions with project overrides.
 * Returns one ResolvedRuleState per known rule id.
 */
export function resolveRuleStates(
  definitions: RuleDefinition[],
  project: ProjectRulesConfig | null
): Map<string, ResolvedRuleState> {
  const out = new Map<string, ResolvedRuleState>();
  const rules = project?.rules ?? {};

  for (const def of definitions) {
    const entry = rules[def.id];
    let enabled = def.enabled;
    let severity: "error" | "warning" | "info" = def.severity === "info" ? "info" : def.severity;

    if (entry !== undefined) {
      const ns = normalizeSeverity(entry);
      if (ns === "off") {
        enabled = false;
      } else if (ns === "error" || ns === "warning" || ns === "info") {
        severity = ns;
        enabled = true;
      } else if (typeof entry === "object" && entry && "enabled" in entry && entry.enabled === false) {
        enabled = false;
      }
    }

    out.set(def.id, { id: def.id, enabled, severity });
  }

  return out;
}

/** Returns true if file path (posix-style rel) should be ignored */
export function shouldIgnoreFile(
  relPosix: string,
  ignorePatterns: string[] | undefined
): boolean {
  if (!ignorePatterns?.length) return false;
  for (const pat of ignorePatterns) {
    if (matchGlob(relPosix, pat)) return true;
  }
  return false;
}

/** Minimal glob: ** matches, * matches within segment */
function matchGlob(input: string, pattern: string): boolean {
  const p = pattern.replace(/\\/g, "/");
  const i = input.replace(/\\/g, "/");
  if (p === "**" || p === "*") return true;
  const re = globToRegExp(p);
  return re.test(i);
}

function globToRegExp(glob: string): RegExp {
  let s = "";
  for (let k = 0; k < glob.length; k++) {
    const c = glob[k];
    if (c === "*") {
      if (glob[k + 1] === "*") {
        s += ".*";
        k++;
      } else {
        s += "[^/]*";
      }
    } else if (c === "?") {
      s += "[^/]";
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      s += "\\" + c;
    } else {
      s += c;
    }
  }
  return new RegExp(`^${s}$`, "i");
}

export type RuleRuntimeContext = {
  cwd: string;
  /** Resolved enabled + severity per rule id */
  states: Map<string, ResolvedRuleState>;
  definitionsById: Map<string, RuleDefinition>;
  ignorePatterns: string[];
};

export async function buildRuleRuntimeContext(cwd: string): Promise<RuleRuntimeContext> {
  const builtIn = await loadBuiltInRuleDefinitions();
  const project = await loadProjectRulesConfig(cwd);
  const states = resolveRuleStates(builtIn, project);
  const definitionsById = new Map(builtIn.map((d) => [d.id, d]));
  const ignorePatterns = project?.ignorePatterns ?? [];
  return { cwd, states, definitionsById, ignorePatterns };
}

/** Quick path: default context when .pi/rules.json absent */
export async function buildDefaultRuleRuntimeContext(cwd: string): Promise<RuleRuntimeContext> {
  return buildRuleRuntimeContext(cwd);
}
