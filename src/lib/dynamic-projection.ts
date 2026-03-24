import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { z } from "zod";

type JsonObject = Record<string, unknown>;

function getProjectionModelId(): string {
  const modelId =
    process.env.GOOGLE_BRAND_PROJECTION_MODEL ??
    process.env.GOOGLE_DEFAULT_MODEL ??
    "gemini-2.0-flash";
  return modelId;
}

function getProjectionMaxOutputTokens(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_PROJECTION_MAX_OUTPUT_TOKENS ?? "800");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 800;
}

function getProjectionMaxDnaChars(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_PROJECTION_MAX_DNA_CHARS ?? "20000");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 20000;
}

function getProjectionModelUseCaseChars(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_PROJECTION_MODEL_USE_CASE_CHARS ?? "500");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 500;
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n\n[TRUNCATED_FOR_COST_CONTROL]`;
}

function logProjectionFailure(
  stage: "structured" | "text" | "text_retry",
  modelId: string,
  error: unknown,
  sizes: { useCaseChars: number; dnaJsonChars: number }
) {
  const err = error as Error & { cause?: unknown };
  console.error("[dynamic_projection]", {
    stage,
    modelId,
    message: err?.message ?? String(error),
    name: typeof err?.name === "string" ? err.name : undefined,
    cause: err?.cause != null ? String(err.cause) : undefined,
    ...sizes,
  });
}

function extractJsonObject(raw: string): JsonObject {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed) as JsonObject;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as JsonObject;
  }

  throw new Error("Projection model did not return a JSON object.");
}

function buildDeterministicProjection(useCase: string, brandDna: unknown): JsonObject {
  const dna = (brandDna ?? {}) as Record<string, unknown>;
  const palette = Array.isArray(dna.color_palette)
    ? dna.color_palette.filter((value): value is string => typeof value === "string")
    : [];
  const assets = Array.isArray(dna.assets)
    ? dna.assets.filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
    : [];
  const logo = assets.find((asset) => asset.kind === "logo");

  return {
    use_case: useCase,
    brand_projection: {
      primary_background_hex:
        typeof dna.primary_background_hex === "string"
          ? dna.primary_background_hex
          : (palette[0] ?? "#FFFFFF"),
      primary_accent_hex:
        typeof dna.primary_accent_hex === "string"
          ? dna.primary_accent_hex
          : (palette[2] ?? palette[1] ?? "#1D1D1F"),
      color_palette: palette.slice(0, 4),
      typography_rules: typeof dna.typography_rules === "string" ? dna.typography_rules : null,
      core_slogan: typeof dna.core_slogan === "string" ? dna.core_slogan : null,
      imagen_style_conditioning:
        typeof dna.imagen_style_conditioning === "string" ? dna.imagen_style_conditioning : null,
      logo_url: typeof logo?.url === "string" ? logo.url : null,
    },
    meta: {
      source: "deterministic_projection",
      reason: "model_unavailable_or_invalid_json",
    },
  };
}

export async function generateDynamicProjection(params: {
  useCase: string;
  brandDna: unknown;
}): Promise<JsonObject> {
  const modelId = getProjectionModelId();
  const maxOutputTokens = getProjectionMaxOutputTokens();
  const maxDnaChars = getProjectionMaxDnaChars();
  const maxUseCaseForModel = getProjectionModelUseCaseChars();
  const useCaseForModel = clampText(params.useCase, maxUseCaseForModel);
  const dnaJson = clampText(JSON.stringify(params.brandDna ?? {}), maxDnaChars);
  const sizeLog = {
    useCaseChars: params.useCase.length,
    dnaJsonChars: dnaJson.length,
  };

  const prompt = [
    `Use case: "${useCaseForModel}"`,
    "Task: return one compact JSON object for application integration.",
    "Rules: no prose, no markdown, no debug fields, no confidence fields.",
    "Include only keys needed for the use case.",
    `brand_dna: ${dnaJson}`,
  ].join("\n");

  try {
    const structured = await generateObject({
      model: google(modelId),
      maxOutputTokens,
      schema: z.record(z.unknown()),
      system: "Return one valid JSON object only.",
      prompt,
    });
    return structured.object;
  } catch (error) {
    logProjectionFailure("structured", modelId, error, sizeLog);
  }

  try {
    const response = await generateText({
      model: google(modelId),
      maxOutputTokens,
      system: "Return one valid JSON object only.",
      prompt,
    });
    return extractJsonObject(response.text);
  } catch (error) {
    logProjectionFailure("text", modelId, error, sizeLog);
  }

  try {
    const retry = await generateText({
      model: google(modelId),
      maxOutputTokens,
      system: "Output exactly one compact JSON object and nothing else.",
      prompt: `${prompt}\nIMPORTANT: respond with JSON object only.`,
    });
    return extractJsonObject(retry.text);
  } catch (error) {
    logProjectionFailure("text_retry", modelId, error, sizeLog);
    console.error("[dynamic_projection]", {
      stage: "deterministic",
      modelId,
      reason: "all_model_attempts_failed",
      ...sizeLog,
    });
    return buildDeterministicProjection(params.useCase, params.brandDna);
  }
}
