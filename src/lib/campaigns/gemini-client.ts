import { GoogleGenAI } from "@google/genai";

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback?.trim()) return fallback.trim();
  throw new Error(`Missing required environment variable: ${name}`);
}

export function getCampaignGeminiClient(): GoogleGenAI {
  const apiKey = readEnv("GEMINI_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  return new GoogleGenAI({ apiKey });
}

export function getCampaignOrchestratorModelId(): string {
  const model =
    process.env.GOOGLE_CAMPAIGN_ORCHESTRATOR_MODEL ??
    process.env.GOOGLE_ADS_ORCHESTRATOR_MODEL ??
    process.env.GOOGLE_DEFAULT_MODEL;
  if (!model?.trim()) {
    throw new Error(
      "Missing GOOGLE_CAMPAIGN_ORCHESTRATOR_MODEL (or GOOGLE_ADS_ORCHESTRATOR_MODEL / GOOGLE_DEFAULT_MODEL)."
    );
  }
  return model.trim();
}

export function getCampaignImageModelId(): string {
  return process.env.GOOGLE_CAMPAIGN_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image-preview";
}
