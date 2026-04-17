/**
 * Lightweight intent ↔ session matching (no extra deps).
 * Used for omnirouter resume hints and `pi sessions` relevance ordering.
 */

const STOP = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "we",
  "you",
  "i",
  "our",
  "your",
  "this",
  "that",
  "with",
  "from",
  "as",
  "at",
  "by",
  "not",
  "no",
  "yes",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "just",
  "use",
  "using",
  "need",
  "want",
  "get",
  "got",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function substringBoost(query: string, haystack: string): number {
  const q = query.toLowerCase().trim();
  const h = haystack.toLowerCase();
  if (q.length < 3) return 0;
  if (h.includes(q)) return 0.35;
  const words = tokenize(query);
  let hits = 0;
  for (const w of words) {
    if (w.length > 2 && h.includes(w)) hits++;
  }
  const denom = Math.max(1, words.length);
  return (hits / denom) * 0.25;
}

/**
 * Score in [0, 1] — higher is better match between user query and stored intent/summary.
 */
export function scoreIntentMatch(query: string, intentSummary: string, lastMessage?: string): number {
  const qTokens = new Set(tokenize(query));
  const iTokens = new Set(tokenize(intentSummary));
  const base = jaccard(qTokens, iTokens);
  let bonus = substringBoost(query, intentSummary);
  if (lastMessage) {
    bonus = Math.max(bonus, substringBoost(query, lastMessage) * 0.85);
  }
  return Math.min(1, base * 0.65 + bonus);
}

export function extractKeywords(text: string): string[] {
  return [...new Set(tokenize(text))].slice(0, 32);
}
