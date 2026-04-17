import Conf from "conf";
import { homedir } from "node:os";
import path from "node:path";
import { fingerprintCwd } from "./session-store.js";

export type ArchitecturalPattern = {
  pattern_id: string;
  cwd_fingerprint: string;
  pattern_type: "tech_choice" | "code_pattern" | "team_preference" | "constraint";
  category: string; // e.g., "billing", "auth", "data_fetching"
  description: string;
  confidence: number; // 0-1
  evidence: string[]; // File paths or resonance session IDs that support this pattern
  learned_at: number; // timestamp
  last_reinforced: number; // timestamp
  reinforcement_count: number;
};

export type SessionLearnings = {
  patterns: ArchitecturalPattern[];
};

function emptyLearnings(): SessionLearnings {
  return { patterns: [] };
}

function getLearningsConf(): Conf<SessionLearnings> {
  return new Conf<SessionLearnings>({
    projectName: "pi-cli",
    cwd: path.join(homedir(), ".config", "pi"),
    configName: "learnings",
    defaults: emptyLearnings(),
  });
}

/**
 * Record a learned architectural pattern from a resonate session
 */
export function recordPattern(params: {
  cwd: string;
  category: string;
  description: string;
  evidence: string[];
  patternType?: ArchitecturalPattern["pattern_type"];
  confidence?: number;
}): void {
  const conf = getLearningsConf();
  const cwdFp = fingerprintCwd(params.cwd);
  const now = Date.now();

  const patterns = conf.get("patterns") ?? [];
  
  // Check if similar pattern exists (fuzzy match on description)
  const existing = patterns.find(
    (p) =>
      p.cwd_fingerprint === cwdFp &&
      p.category === params.category &&
      p.description.toLowerCase().includes(params.description.toLowerCase().slice(0, 30))
  );

  if (existing) {
    // Reinforce existing pattern
    existing.last_reinforced = now;
    existing.reinforcement_count += 1;
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    existing.evidence.push(...params.evidence.filter((e) => !existing.evidence.includes(e)));
  } else {
    // Create new pattern
    const patternId = `${cwdFp}-${params.category}-${Date.now()}`;
    patterns.push({
      pattern_id: patternId,
      cwd_fingerprint: cwdFp,
      pattern_type: params.patternType ?? "tech_choice",
      category: params.category,
      description: params.description,
      confidence: params.confidence ?? 0.5,
      evidence: params.evidence,
      learned_at: now,
      last_reinforced: now,
      reinforcement_count: 1,
    });
  }

  conf.set("patterns", patterns.slice(-500)); // Keep last 500 patterns
}

/**
 * Retrieve relevant patterns for a given intent and codebase
 */
export function recallPatterns(params: {
  cwd: string;
  category?: string;
  minConfidence?: number;
  limit?: number;
}): ArchitecturalPattern[] {
  const conf = getLearningsConf();
  const cwdFp = fingerprintCwd(params.cwd);
  const patterns = conf.get("patterns") ?? [];
  const minConf = params.minConfidence ?? 0.3;
  const limit = params.limit ?? 10;

  return patterns
    .filter((p) => p.cwd_fingerprint === cwdFp && p.confidence >= minConf)
    .filter((p) => !params.category || p.category === params.category)
    .sort((a, b) => {
      // Sort by confidence * recency
      const scoreA = a.confidence * (1 / Math.max(1, (Date.now() - a.last_reinforced) / (24 * 60 * 60 * 1000)));
      const scoreB = b.confidence * (1 / Math.max(1, (Date.now() - b.last_reinforced) / (24 * 60 * 60 * 1000)));
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

/**
 * Extract category from intent (billing, auth, data, etc.)
 */
export function extractCategoryFromIntent(intent: string): string | undefined {
  const lower = intent.toLowerCase();
  
  if (/billing|payment|stripe|subscription|checkout/.test(lower)) return "billing";
  if (/auth|login|sign.?up|session|jwt|oauth/.test(lower)) return "auth";
  if (/webhook|event|background|async|queue/.test(lower)) return "webhooks";
  if (/database|db|postgres|mysql|prisma|supabase/.test(lower)) return "database";
  if (/api|endpoint|route|handler/.test(lower)) return "api_routes";
  if (/state|redux|zustand|context/.test(lower)) return "state_management";
  if (/cache|redis|memory/.test(lower)) return "caching";
  if (/email|notification|sms/.test(lower)) return "notifications";
  
  return undefined;
}

/**
 * Format patterns as memory context string for LLM
 */
export function formatPatternsAsMemory(patterns: ArchitecturalPattern[]): string {
  if (patterns.length === 0) return "";

  const lines = ["**Past Architectural Patterns (Your Team's Preferences):**", ""];
  
  for (const p of patterns) {
    const conf = (p.confidence * 100).toFixed(0);
    const count = p.reinforcement_count > 1 ? ` (${p.reinforcement_count}x)` : "";
    lines.push(`- **${p.category}**: ${p.description} ${count} [confidence: ${conf}%]`);
  }
  
  lines.push("");
  return lines.join("\n");
}
