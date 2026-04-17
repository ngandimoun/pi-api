/**
 * Runs when the Next.js Node server starts (`next start`, dev server). Not used to gate `next build`.
 * Ensures Mastra agents fail fast in production if the default model is unset.
 */
export async function register() {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.PI_MASTRA_DEFAULT_MODEL?.trim()) {
    throw new Error("PI_MASTRA_DEFAULT_MODEL is required in production.");
  }
}
