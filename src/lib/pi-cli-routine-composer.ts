import { createPiCliMemory } from "@/lib/pi-cli-memory";

export type RoutineMatch = {
  routine_id: string;
  routine_file: string;
  relevance_score: number;
  reason: string;
};

export type RoutineMetaEntry = {
  id: string;
  tags: string[];
  intent: string;
};

function tokenizeIntent(intent: string): string[] {
  return intent
    .toLowerCase()
    .split(/[^a-z0-9+/]+/g)
    .filter((w) => w.length > 2);
}

function scoreAgainstKeywords(text: string, keywords: string[]): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const k of keywords) {
    if (t.includes(k)) score += 0.15;
  }
  return Math.min(score, 1);
}

function extractRoutineReferencesFromText(text: string): string[] {
  const out = new Set<string>();
  const re = /\broutine[:\s#]+([a-z0-9][a-z0-9-]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.add(m[1]);
  }
  return [...out];
}

/**
 * Rank existing routines by relevance to the current intent (keywords + optional metadata + memory).
 */
export async function findRelevantRoutines(
  _organizationId: string,
  threadId: string | undefined,
  intent: string,
  routineIds: string[],
  metadata?: RoutineMetaEntry[]
): Promise<RoutineMatch[]> {
  const keywords = tokenizeIntent(intent);
  const metaById = new Map<string, RoutineMetaEntry>();
  for (const m of metadata ?? []) {
    metaById.set(m.id, m);
  }

  const matches: RoutineMatch[] = [];

  for (const id of routineIds) {
    const slug = id.toLowerCase();
    let score = scoreAgainstKeywords(slug, keywords);
    const reasons: string[] = [];
    if (score > 0) reasons.push(`id/slug keywords: ${keywords.filter((k) => slug.includes(k)).join(", ") || "—"}`);

    const meta = metaById.get(id);
    if (meta) {
      const tagScore = scoreAgainstKeywords(meta.tags.join(" "), keywords);
      const intentScore = scoreAgainstKeywords(meta.intent, keywords);
      const combined = Math.max(tagScore, intentScore) * 1.2;
      if (combined > score) {
        score = Math.min(combined, 1);
        reasons.length = 0;
        if (tagScore > 0.05) reasons.push(`tags [${meta.tags.join(", ")}]`);
        if (intentScore > 0.05) reasons.push(`prior intent match`);
      } else {
        score = Math.max(score, combined * 0.9);
        if (tagScore > 0.05) reasons.push(`tags [${meta.tags.join(", ")}]`);
      }
    }

    if (score >= 0.15) {
      matches.push({
        routine_id: id,
        routine_file: `.pi/routines/${id}.v*.md`,
        relevance_score: Number(score.toFixed(3)),
        reason: reasons.join("; ") || "metadata/heuristic match",
      });
    }
  }

  const mem = createPiCliMemory();
  if (mem && threadId?.trim()) {
    try {
      const { messages } = await mem.recall({
        threadId,
        perPage: 12,
        vectorSearchString: intent.slice(0, 2000),
        threadConfig: {
          semanticRecall: Boolean(
            process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
              process.env.GEMINI_KEY?.trim() ||
              process.env.GEMINI_API_KEY?.trim()
          ),
        },
      });
      for (const msg of messages) {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        for (const ref of extractRoutineReferencesFromText(content)) {
          if (routineIds.includes(ref)) {
            matches.push({
              routine_id: ref,
              routine_file: `.pi/routines/${ref}.v*.md`,
              relevance_score: 0.75,
              reason: "Referenced in Mastra memory thread",
            });
          }
        }
      }
    } catch {
      /* optional */
    }
  }

  const seen = new Map<string, RoutineMatch>();
  for (const m of matches) {
    const prev = seen.get(m.routine_id);
    if (!prev || m.relevance_score > prev.relevance_score) {
      seen.set(m.routine_id, m);
    }
  }
  return [...seen.values()].sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 8);
}
