import { GoogleGenAI } from "@google/genai";
import { google } from "@ai-sdk/google";
import { imageSize } from "image-size";
import { z } from "zod";

import type { AdDirectiveV1, AdGenerationInput } from "@/contracts/ads-api";
import type { AdCorpusReference } from "@/lib/ads/retrieve-reference";
import type { NormalizedReferenceImage } from "@/lib/ads/reference-inputs";

function getOrchestratorModelId(): string {
  const modelId =
    process.env.GOOGLE_ADS_ORCHESTRATOR_MODEL ??
    process.env.GOOGLE_AVATAR_ORCHESTRATOR_MODEL ??
    process.env.GOOGLE_DEFAULT_MODEL;
  if (!modelId?.trim()) {
    throw new Error("Missing GOOGLE_ADS_ORCHESTRATOR_MODEL (or GOOGLE_DEFAULT_MODEL).");
  }
  return modelId.trim();
}

function getEvaluatorModelId(): string {
  const modelId = process.env.GOOGLE_ADS_EVALUATOR_MODEL ?? getOrchestratorModelId();
  return modelId.trim();
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey?.trim()) throw new Error("Missing GEMINI_KEY.");
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed) as Record<string, unknown>;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }
  throw new Error("No JSON object found in model output.");
}

const copySlotSchema = z.object({
  slot_type: z.enum(["headline", "cta", "subcopy", "badge"]),
  requested_text_or_intent: z.string().min(1),
  language: z.string().min(2),
  script: z.string().min(1).default("auto"),
  priority: z.number().int().min(1).max(8).default(1),
  source_fragment: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

const copySlotExtractionSchema = z.object({
  slots: z.array(copySlotSchema).default([]),
});

export type AdCopySlot = z.infer<typeof copySlotSchema>;

const languageAliasToCode: Record<string, string> = {
  arabic: "ar",
  chinese: "zh",
  japanese: "ja",
  french: "fr",
  english: "en",
  korean: "ko",
  russian: "ru",
  spanish: "es",
  portuguese: "pt",
  german: "de",
  italian: "it",
};

function detectSlotType(fragment: string): AdCopySlot["slot_type"] {
  const lower = fragment.toLowerCase();
  if (/cta|call to action|buy now|shop now|order now|discover|learn more/.test(lower)) return "cta";
  if (/headline|title|hero|slogan/.test(lower)) return "headline";
  if (/badge|label|sticker/.test(lower)) return "badge";
  return "subcopy";
}

export function extractCopySlots(input: AdGenerationInput): AdCopySlot[] {
  const prompt = input.prompt;
  const lower = prompt.toLowerCase();
  const slots: AdCopySlot[] = [];
  const seen = new Set<string>();

  for (const [alias, code] of Object.entries(languageAliasToCode)) {
    const regex = new RegExp(
      `([^,.\\n]{1,120}?)\\s+in\\s+${alias}(?=$|\\s+and\\s+|\\s+with\\s+|[,.])`,
      "ig"
    );
    let match: RegExpExecArray | null = regex.exec(prompt);
    while (match) {
      const fragment = match[1]?.trim();
      if (fragment) {
        const slotType = detectSlotType(fragment);
        const key = `${slotType}:${code}:${fragment.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          slots.push({
            slot_type: slotType,
            requested_text_or_intent: fragment.replace(/^with\s+the\s+text\s+/i, "").trim(),
            language: code,
            script: code === "ar" ? "arabic" : code === "zh" ? "chinese" : "auto",
            priority: slotType === "headline" ? 1 : slotType === "cta" ? 2 : 3,
            source_fragment: match[0],
            confidence: 0.78,
          });
        }
      }
      match = regex.exec(prompt);
    }
  }

  // If user explicitly says "text ... in <language>" but no CTA/headline cue,
  // ensure at least one headline-like slot exists.
  if (slots.length === 0 && /\btext\b/i.test(lower)) {
    const fallbackLang = /arabic/.test(lower)
      ? "ar"
      : /chinese/.test(lower)
        ? "zh"
        : /japanese/.test(lower)
          ? "ja"
          : /french/.test(lower)
            ? "fr"
            : "en";
    slots.push({
      slot_type: "headline",
      requested_text_or_intent: "match requested text intent",
      language: fallbackLang,
      script: "auto",
      priority: 1,
      source_fragment: "fallback_text_rule",
      confidence: 0.55,
    });
  }

  return copySlotExtractionSchema.parse({ slots }).slots.sort((a, b) => a.priority - b.priority);
}

export const promptUnderstandingSchema = z.object({
  inferred_objective: z.string().min(1),
  product_focus: z.string().min(1),
  target_market: z.string().min(1),
  language_code: z.string().min(2),
  include_human: z.boolean(),
});

export type AdsDifficultyTier = "fast_path" | "standard_path" | "hard_path";

export function classifyDifficulty(input: AdGenerationInput): {
  tier: AdsDifficultyTier;
  reasons: string[];
} {
  const reasons: string[] = [];
  const prompt = input.prompt.toLowerCase();
  const refCount = input.reference_images?.length ?? 0;
  const hasBrand = Boolean(input.brand_id || input.brand_identity_json);
  const hasCrossCultureHints =
    /africa|japan|asia|arab|france|russia|culture|local/i.test(input.prompt);
  const hasLanguageSpecificHints =
    /in french|in japanese|in arabic|language|script|cta/i.test(prompt);
  const isLongPrompt = input.prompt.length > 1200;

  if (refCount >= 4) reasons.push("many_references");
  if (hasBrand) reasons.push("brand_constraints");
  if (hasCrossCultureHints) reasons.push("cross_culture");
  if (hasLanguageSpecificHints) reasons.push("language_specific");
  if (isLongPrompt) reasons.push("long_prompt");

  if (reasons.length >= 3) return { tier: "hard_path", reasons };
  if (reasons.length === 0 && refCount === 0) return { tier: "fast_path", reasons: ["simple_prompt"] };
  return { tier: "standard_path", reasons };
}

export async function runPromptUnderstanding(input: AdGenerationInput) {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: getOrchestratorModelId(),
    contents: [
      {
        text: [
          "Return ONLY one JSON object (no markdown, no code fences).",
          "Task: extract ad intent fields from the user prompt.",
          "Keys: inferred_objective, product_focus, target_market, language_code, include_human.",
          "Rules: keep strings short; language_code should be like 'ja' or 'ar' or 'fr'.",
          `USER_PROMPT: ${input.prompt}`,
        ].join("\n"),
      },
    ],
  });
  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";
  return promptUnderstandingSchema.parse(parseJsonObject(text));
}

const creativePlanSchema = z.object({
  headline_idea: z.string().min(1),
  layout_intent: z.string().min(1),
  audience_signal: z.string().min(1),
  cta_strategy: z.string().min(1),
  visual_hierarchy: z.array(z.string().min(1)).min(2).max(8),
  script_notes: z.string().default(""),
  cultural_notes: z.string().default(""),
});

type BuildDirectiveParams = {
  input: AdGenerationInput;
  promptUnderstanding: z.infer<typeof promptUnderstandingSchema>;
  uploadedSummary: string;
  corpusReference: AdCorpusReference | null;
  brandConstraints: string[];
};

export async function runCreativePlanner(
  params: BuildDirectiveParams
): Promise<AdDirectiveV1["creative_plan"] & { script_notes: string; cultural_notes: string }> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: getOrchestratorModelId(),
    contents: [
      {
        text: [
          "You are a Creative Planner Agent for static marketing ads.",
          "Return ONLY one JSON object (no markdown, no code fences).",
          "Keys: headline_idea, layout_intent, audience_signal, cta_strategy, visual_hierarchy (array), script_notes, cultural_notes.",
          "Constraints: visual_hierarchy length 2..8, each entry short.",
          `USER_PROMPT: ${params.input.prompt}`,
          `INFERRED_OBJECTIVE: ${params.promptUnderstanding.inferred_objective}`,
          `PRODUCT_FOCUS: ${params.promptUnderstanding.product_focus}`,
          `TARGET_MARKET: ${params.promptUnderstanding.target_market}`,
          `LANGUAGE_CODE: ${params.promptUnderstanding.language_code}`,
          `UPLOADED_IMAGE_SUMMARY: ${params.uploadedSummary || "none"}`,
          `CORPUS_PROMPT: ${params.corpusReference?.row.master_prompt ?? "none"}`,
          `CORPUS_METADATA: ${JSON.stringify(params.corpusReference?.row.metadata ?? {})}`,
          `BRAND_CONSTRAINTS: ${params.brandConstraints.join(" | ") || "none"}`,
        ].join("\n"),
      },
    ],
  });
  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";
  return creativePlanSchema.parse(parseJsonObject(text));
}

export async function summarizeImages(
  images: NormalizedReferenceImage[],
  corpusReference: AdCorpusReference | null
): Promise<string> {
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    {
      text: [
        "Analyze these ad reference images for static marketing generation.",
        "Return only JSON with keys: visual_style, composition, text_density, human_presence, product_visibility, notable_copy_language.",
      ].join("\n"),
    },
  ];

  for (const image of images) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.buffer.toString("base64"),
      },
    });
  }
  if (corpusReference) {
    parts.push({
      inlineData: {
        mimeType: corpusReference.mimeType,
        data: corpusReference.imageBytes.toString("base64"),
      },
    });
  }

  const model = getOrchestratorModelId();
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model,
    contents: parts,
  });
  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  if (!text) {
    return "No usable image summary.";
  }
  const parsed = parseJsonObject(text);
  return JSON.stringify(parsed);
}

const evaluatorSchema = z.object({
  ad_clarity: z.number().min(0).max(100),
  cta_visibility: z.number().min(0).max(100),
  language_correctness: z.number().min(0).max(100),
  cultural_fit: z.number().min(0).max(100),
  product_prominence: z.number().min(0).max(100),
  summary: z.string().min(1),
});

export async function evaluateGeneratedAd(params: {
  directive: AdDirectiveV1;
  imageBuffer: Buffer;
  mimeType: string;
}) {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: getEvaluatorModelId(),
    contents: [
      {
        text: [
          "Evaluate this static ad image and return ONLY JSON.",
          "Required keys: ad_clarity, cta_visibility, language_correctness, cultural_fit, product_prominence, summary.",
          "Each numeric score must be 0..100.",
          `TARGET_LANGUAGE: ${params.directive.culture_language_script_plan.language_code}`,
          `TARGET_MARKET: ${params.directive.request_intent.target_market}`,
          `CTA_STRATEGY: ${params.directive.creative_plan.cta_strategy}`,
        ].join("\n"),
      },
      {
        inlineData: {
          mimeType: params.mimeType,
          data: params.imageBuffer.toString("base64"),
        },
      },
    ],
  });
  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";
  const object = evaluatorSchema.parse(parseJsonObject(text));

  const average =
    (object.ad_clarity +
      object.cta_visibility +
      object.language_correctness +
      object.cultural_fit +
      object.product_prominence) /
    5;

  return {
    ...object,
    total_score: Math.round(average),
  };
}

const copySlotValidationSchema = z.object({
  pass: z.boolean(),
  violations: z.array(
    z.object({
      slot_type: z.string(),
      language: z.string(),
      reason: z.string(),
    })
  ),
  summary: z.string().default(""),
});

export async function validateCopySlots(params: {
  directive: AdDirectiveV1;
  imageBuffer: Buffer;
  mimeType: string;
}) {
  const slots = params.directive.copy_slots ?? [];
  if (slots.length === 0) {
    return { pass: true, violations: [], summary: "no_copy_slots_requested" };
  }
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: getEvaluatorModelId(),
    contents: [
      {
        text: [
          "Validate requested copy slots on this ad image.",
          "Return ONLY JSON with keys: pass (boolean), violations (array), summary.",
          "Each violation item keys: slot_type, language, reason.",
          `REQUESTED_SLOTS_JSON: ${JSON.stringify(slots)}`,
        ].join("\n"),
      },
      {
        inlineData: {
          mimeType: params.mimeType,
          data: params.imageBuffer.toString("base64"),
        },
      },
    ],
  });

  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  return copySlotValidationSchema.parse(parseJsonObject(text));
}

export function runDeterministicQualityGate(params: {
  imageBuffer: Buffer;
  expectedAspectRatio: string;
  minBytes?: number;
}): {
  pass: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const minBytes = params.minBytes ?? 12000;
  if (params.imageBuffer.length < minBytes) {
    reasons.push("image_too_small_bytes");
  }

  try {
    const dimensions = imageSize(params.imageBuffer);
    if (!dimensions.width || !dimensions.height) {
      reasons.push("missing_dimensions");
    } else {
      const ratio = dimensions.width / dimensions.height;
      const [wRaw, hRaw] = params.expectedAspectRatio.split(":");
      const expected = Number(wRaw) / Number(hRaw);
      if (Number.isFinite(expected) && Math.abs(ratio - expected) > 0.22) {
        reasons.push("aspect_ratio_mismatch");
      }
    }
  } catch {
    reasons.push("dimension_parse_failed");
  }

  return {
    pass: reasons.length === 0,
    reasons,
  };
}

