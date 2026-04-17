const DEFAULT_DEV_MODEL = "google/gemini-3.1-pro-preview-customtools";

/**
 * Resolves the Mastra default model id. Must not throw at module load time (Next bundles API routes during `next build`).
 * Production deployments should set `PI_MASTRA_DEFAULT_MODEL`; startup validation lives in `src/instrumentation.ts`.
 */
export function getMastraDefaultModel(): string {
  const value = process.env.PI_MASTRA_DEFAULT_MODEL?.trim();
  if (value) {
    return value;
  }

  return DEFAULT_DEV_MODEL;
}
