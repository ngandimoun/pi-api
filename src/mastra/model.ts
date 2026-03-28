const DEFAULT_DEV_MODEL = "openai/gpt-5-mini";

export function getMastraDefaultModel(): string {
  const value = process.env.PI_MASTRA_DEFAULT_MODEL?.trim();
  if (value) {
    return value;
  }

  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    throw new Error("PI_MASTRA_DEFAULT_MODEL is required in production.");
  }

  return DEFAULT_DEV_MODEL;
}

