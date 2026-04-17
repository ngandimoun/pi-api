import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

import { getMastraPgVector, getMastraPostgresStore } from "@/lib/mastra-storage";

function parseRecallLimit(): number {
  const raw = process.env.PI_CLI_MEMORY_RECALL_LIMIT?.trim();
  if (!raw) return 5;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 5;
}

export { buildCliResourceId, buildCliThreadId } from "@/lib/pi-cli-thread";

export function isCliMemoryEnabled(): boolean {
  if (process.env.PI_CLI_ENABLE_MEMORY === "false") return false;
  return Boolean(getMastraPostgresStore());
}

/**
 * Mastra Memory for CLI agents when Postgres storage is configured.
 * Semantic recall uses Google embeddings when GEMINI / GOOGLE keys are present.
 */
export function createPiCliMemory(): Memory | null {
  const storage = getMastraPostgresStore();
  if (!storage) return null;

  const vector = getMastraPgVector();
  const recallLimit = parseRecallLimit();
  const hasGoogleKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GEMINI_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim()
  );

  return new Memory({
    storage,
    ...(vector && hasGoogleKey
      ? {
          vector,
          embedder: new ModelRouterEmbeddingModel("google/gemini-embedding-2-preview"),
        }
      : {}),
    options: {
      lastMessages: 20,
      semanticRecall: vector && hasGoogleKey ? { topK: recallLimit, messageRange: 1, scope: "resource" } : false,
    },
  });
}
