import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import {
  brandExtractionInputSchema,
  parseBase64Asset,
  type BrandExtractionInput,
} from "@/lib/brand-extraction";
import { scrapeBrandingProfile } from "@/lib/firecrawl";
import { uploadAsset } from "@/lib/storage";
import { getServiceSupabaseClient } from "@/lib/supabase";

const triggerPayloadSchema = z.object({
  jobId: z.string().min(1),
  organizationId: z.string().min(1),
  input: brandExtractionInputSchema,
});

const hexRegex = /^#[0-9A-Fa-f]{6}$/;

const brandDnaSchema = z.object({
  primary_background_hex: z.string().regex(hexRegex),
  primary_accent_hex: z.string().regex(hexRegex),
  color_palette: z.array(z.string().regex(hexRegex)).length(4),
  typography_rules: z.string().min(1),
  core_slogan: z.string().min(1),
  imagen_style_conditioning: z.string().min(1),
});

type NormalizedAsset = {
  kind: "logo" | "reference" | "website_screenshot";
  url: string;
};

/**
 * Updates job status and payload phase with consistent telemetry fields.
 */
async function updateJobPhase(
  jobId: string,
  status: "processing" | "completed" | "failed",
  phase: string,
  extraPayload?: Record<string, unknown>,
  errorLog?: string
) {
  const supabase = getServiceSupabaseClient();
  const payload = {
    phase,
    ...extraPayload,
  };

  await supabase
    .from("jobs")
    .update({
      status,
      payload,
      error_log: errorLog ?? null,
    })
    .eq("id", jobId);
}

/**
 * Converts extracted input into normalized URLs and crawl context.
 */
async function normalizeAssets(
  organizationId: string,
  jobId: string,
  input: BrandExtractionInput
) {
  const assets: NormalizedAsset[] = [];
  let markdown = "";
  let branding: Record<string, unknown> | null = null;
  let metadata: Record<string, unknown> | null = null;
  let actions: Record<string, unknown> | null = null;

  if (input.logoBase64) {
    const parsed = parseBase64Asset(input.logoBase64);
    const key = `brands/${organizationId}/${jobId}/logo.${parsed.extension}`;
    const url = await uploadAsset(parsed.buffer, key, parsed.contentType);
    assets.push({ kind: "logo", url });
  }

  if (input.imagesBase64?.length) {
    for (let i = 0; i < input.imagesBase64.length; i += 1) {
      const parsed = parseBase64Asset(input.imagesBase64[i]);
      const key = `brands/${organizationId}/${jobId}/reference_${i + 1}.${parsed.extension}`;
      const url = await uploadAsset(parsed.buffer, key, parsed.contentType);
      assets.push({ kind: "reference", url });
    }
  }

  if (input.url) {
    const firecrawlResult = await scrapeBrandingProfile(input.url, {
      location: input.location,
    });
    markdown = firecrawlResult.markdown;
    branding = firecrawlResult.branding;
    metadata = firecrawlResult.metadata;
    actions = firecrawlResult.actions;

    if (firecrawlResult.screenshotUrl) {
      let screenshotResponse: Response;
      try {
        screenshotResponse = await fetch(firecrawlResult.screenshotUrl);
      } catch (error) {
        throw new Error(
          `Failed to fetch Firecrawl screenshot URL: ${firecrawlResult.screenshotUrl}. ${
            error instanceof Error ? error.message : "unknown_error"
          }`
        );
      }
      if (!screenshotResponse.ok) {
        throw new Error(
          `Failed to fetch Firecrawl screenshot URL: ${firecrawlResult.screenshotUrl} (status ${screenshotResponse.status})`
        );
      }
      const screenshotBytes = Buffer.from(await screenshotResponse.arrayBuffer());
      const screenshotContentType =
        screenshotResponse.headers.get("content-type") ?? "image/png";
      const screenshotExtension = screenshotContentType.includes("webp")
        ? "webp"
        : screenshotContentType.includes("jpeg") || screenshotContentType.includes("jpg")
          ? "jpg"
          : "png";
      const screenshotKey = `brands/${organizationId}/${jobId}/screenshot.${screenshotExtension}`;
      const screenshotUrl = await uploadAsset(
        screenshotBytes,
        screenshotKey,
        screenshotContentType
      );
      assets.push({
        kind: "website_screenshot",
        url: screenshotUrl,
      });
    }

    console.info("[omnivorous-brand-extractor] firecrawl_complete", {
      jobId,
      hasMarkdown: Boolean(markdown),
      hasBranding: Boolean(branding),
      hasScreenshot: Boolean(firecrawlResult.screenshotUrl),
      hasActions: Boolean(actions),
    });
  }

  return {
    assets,
    markdown,
    branding,
    metadata,
    actions,
  };
}

function getVisionModelId(): string {
  const modelId = process.env.GOOGLE_BRAND_VISION_MODEL ?? process.env.GOOGLE_DEFAULT_MODEL;
  if (!modelId?.trim()) {
    throw new Error(
      "Missing GOOGLE_BRAND_VISION_MODEL (or GOOGLE_DEFAULT_MODEL) for vision analysis."
    );
  }
  return modelId;
}

function getStructuringModelId(): string {
  const modelId =
    process.env.GOOGLE_BRAND_STRUCTURING_MODEL ?? process.env.GOOGLE_DEFAULT_MODEL;
  if (!modelId?.trim()) {
    throw new Error(
      "Missing GOOGLE_BRAND_STRUCTURING_MODEL (or GOOGLE_DEFAULT_MODEL) for JSON structuring."
    );
  }
  return modelId;
}

function getThinkingLevel(): "low" | "medium" | "high" {
  const configured = (process.env.GOOGLE_BRAND_THINKING_LEVEL ?? "medium").trim().toLowerCase();
  if (configured === "low" || configured === "high") {
    return configured;
  }
  return "medium";
}

function getVisionMaxOutputTokens(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_VISION_MAX_OUTPUT_TOKENS ?? "1200");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1200;
}

function getStructuringMaxOutputTokens(): number {
  const parsed = Number(process.env.GOOGLE_BRAND_STRUCTURING_MAX_OUTPUT_TOKENS ?? "700");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 700;
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n\n[TRUNCATED_FOR_COST_CONTROL]`;
}

function compactJson(value: unknown, maxChars: number): string {
  const serialized = JSON.stringify(value ?? {});
  return clampText(serialized, maxChars);
}

function tryParseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
  throw new Error("No JSON object found in model response.");
}

function isHex(value: unknown): value is string {
  return typeof value === "string" && hexRegex.test(value);
}

function buildFallbackColorPalette(
  backgroundHex: string,
  accentHex: string,
  branding: Record<string, unknown> | null
): string[] {
  const colors = (branding?.colors ?? {}) as Record<string, unknown>;
  const candidates = [
    backgroundHex,
    accentHex,
    isHex(colors.textPrimary) ? colors.textPrimary : null,
    isHex(colors.link) ? colors.link : null,
    isHex(colors.primary) ? colors.primary : null,
    isHex(colors.background) ? colors.background : null,
    "#FFFFFF",
    "#1D1D1F",
  ].filter((value): value is string => Boolean(value));

  const unique = Array.from(new Set(candidates));
  return unique.slice(0, 4).length === 4
    ? unique.slice(0, 4)
    : [...unique, "#F5F5F7", "#0071E3", "#000000"].slice(0, 4);
}

function buildFallbackBrandDna(params: {
  branding: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  manifesto: string;
}): z.infer<typeof brandDnaSchema> {
  const colors = (params.branding?.colors ?? {}) as Record<string, unknown>;
  const fonts = (params.branding?.fonts ?? []) as Array<Record<string, unknown>>;
  const typography = (params.branding?.typography ?? {}) as Record<string, unknown>;
  const fontFamilies = (typography.fontFamilies ?? {}) as Record<string, unknown>;
  const headingFont =
    fonts.find((font) => font.role === "heading")?.family ??
    fontFamilies.heading;
  const bodyFont =
    fonts.find((font) => font.role === "body")?.family ??
    fontFamilies.primary;

  const primaryBackgroundHex = isHex(colors.background) ? colors.background : "#FFFFFF";
  const primaryAccentHex = isHex(colors.accent)
    ? colors.accent
    : isHex(colors.primary)
      ? colors.primary
      : isHex(colors.link)
        ? colors.link
        : "#0071E3";
  const colorPalette = buildFallbackColorPalette(
    primaryBackgroundHex,
    primaryAccentHex,
    params.branding
  );
  const description =
    (params.metadata?.Description as string | undefined) ??
    (params.metadata?.ogDescription as string | undefined) ??
    "Modern premium brand experience";
  const coreSlogan = description.split(".")[0]?.trim() || "Build with confidence";
  const typographyRules =
    headingFont && bodyFont
      ? `Use ${String(headingFont)} for headings and ${String(bodyFont)} for body text with clear hierarchy.`
      : "Use a modern sans-serif heading and body hierarchy with strong readability.";

  return {
    primary_background_hex: primaryBackgroundHex,
    primary_accent_hex: primaryAccentHex,
    color_palette: colorPalette,
    typography_rules: typographyRules,
    core_slogan: coreSlogan,
    imagen_style_conditioning:
      "Minimalist premium visual style with clean surfaces, balanced contrast, and modern product focus. Maintain sharp lighting, precise composition, and restrained color accents.",
  };
}

const VISION_PROMPT_VERSION = "vision_v2_balanced_compact_visual_first";
const STRUCTURING_PROMPT_VERSION = "structuring_v2_strict_visual_first";

function deriveBrandName(input: BrandExtractionInput, jobId: string): string {
  if (input.url) {
    try {
      const hostname = new URL(input.url).hostname.replace(/^www\./, "");
      if (hostname) {
        return hostname;
      }
    } catch {
      // ignore URL parsing fallback
    }
  }
  return `brand-${jobId.slice(0, 8)}`;
}

function deriveBrandDomain(input: BrandExtractionInput, jobId: string): string {
  if (input.url) {
    try {
      const normalized = new URL(input.url).hostname.toLowerCase().replace(/^www\./, "");
      if (normalized) {
        return normalized;
      }
    } catch {
      // ignore URL parsing fallback
    }
  }
  return `brand-${jobId.slice(0, 8)}`;
}

export const omnivorousBrandExtractor = task({
  id: "omnivorous-brand-extractor",
  run: async (payload) => {
    const parsedPayload = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsedPayload;

    const supabase = getServiceSupabaseClient();

    try {
      console.info("[omnivorous-brand-extractor] start", {
        jobId,
        organizationId,
      });

      await updateJobPhase(jobId, "processing", "phase_a_normalization");

      console.info("[omnivorous-brand-extractor] phase_a_start", { jobId });
      const normalized = await normalizeAssets(organizationId, jobId, input);
      console.info("[omnivorous-brand-extractor] phase_a_end", {
        jobId,
        assetCount: normalized.assets.length,
      });

      await updateJobPhase(jobId, "processing", "phase_b_gemini_manifesto", {
        asset_count: normalized.assets.length,
        has_branding_profile: Boolean(normalized.branding),
      });

      console.info("[omnivorous-brand-extractor] phase_b_start", { jobId });
      const visionModelId = getVisionModelId();
      const thinkingLevel = getThinkingLevel();
      const visionMaxOutputTokens = getVisionMaxOutputTokens();
      const brandingContext = compactJson(normalized.branding, 8000);
      const visionPrompt = [
        "System role: You are an elite Brand Art Director.",
        "Task: extract definitive visual identity from screenshots/logos/reference images plus branding hints.",
        "Priority rule: visual evidence is the source of truth. If text conflicts with visuals, trust visuals.",
        "Output format rules:",
        "- plain text only, no JSON, no markdown tables, no code blocks",
        "- no preamble, no repetition, no disclaimers",
        "- keep concise and high-signal",
        "- maximum 5 sections using these exact headers:",
        "1) Color Palette Signals",
        "2) Typography Behavior",
        "3) Logo Geometry and Placement",
        "4) Photographic/Illustrative Vibe",
        "5) Confidence Notes",
        "- each section: 2-4 bullet points, each bullet <= 18 words",
        "- include up to 4 hex colors only when visually confident",
        "- if a logo exists, describe geometry, stroke/fill style, and placement rules",
        "- avoid filler adjectives and avoid repeating the same trait",
        "",
        "Based on the provided inputs, produce the manifesto now.",
        normalized.branding
          ? `Firecrawl branding profile (compact):\n${brandingContext}`
          : "No Firecrawl branding profile available.",
        `Thinking level preference: ${thinkingLevel}.`,
      ].join("\n");
      const visionResponse = await generateText({
        model: google(visionModelId),
        maxOutputTokens: visionMaxOutputTokens,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: visionPrompt,
              },
              ...normalized.assets.map((asset) => ({
                type: "image" as const,
                image: new URL(asset.url),
              })),
            ],
          },
        ],
      });
      const brandManifesto = visionResponse.text;
      console.info("[omnivorous-brand-extractor] phase_b_end", {
        jobId,
        manifestoLength: brandManifesto.length,
        visionModelId,
        thinkingLevel,
        visionMaxOutputTokens,
        visionPromptVersion: VISION_PROMPT_VERSION,
        visionPromptChars: visionPrompt.length,
      });

      await updateJobPhase(jobId, "processing", "phase_c_gemini_structuring", {
        manifesto_length: brandManifesto.length,
      });

      console.info("[omnivorous-brand-extractor] phase_c_start", { jobId });
      const structuringModelId = getStructuringModelId();
      const structuringMaxOutputTokens = getStructuringMaxOutputTokens();
      const manifestoForStructuring = clampText(brandManifesto, 6000);
      const markdownForStructuring = clampText(normalized.markdown, 12000);
      const brandingForStructuring = compactJson(normalized.branding, 5000);
      const metadataForStructuring = compactJson(normalized.metadata, 3000);
      const structuringPrompt = [
        "Extract strict Brand DNA JSON from the context.",
        "Return ONLY a JSON object matching the required schema.",
        "No prose, no markdown, no extra keys.",
        "Output must be valid minified JSON parseable by JSON.parse.",
        "Conflict policy: visual identity evidence (logo/screenshot/visual manifesto) overrides conflicting page copy.",
        "Anti-bloat rules: keep values concise, avoid repeated phrases, no verbose narration.",
        "Schema constraints:",
        '- primary_background_hex: one dominant background/surface hex code ("#RRGGBB").',
        '- primary_accent_hex: one dominant interaction/CTA accent hex code ("#RRGGBB").',
        '- color_palette: array of exactly 4 unique hex codes ("#RRGGBB").',
        "- typography_rules: one concise implementation-ready sentence.",
        "- core_slogan: one strongest marketable phrase from text context; if unavailable, infer concise brand line.",
        "- imagen_style_conditioning: exactly 2 sentences, prompt-ready, visual-style only.",
        "Color role policy:",
        "- primary_background_hex must represent dominant page background or large neutral surfaces.",
        "- primary_accent_hex must represent primary interaction/CTA accent color.",
        "Return this exact key set and order:",
        '{"primary_background_hex":"#RRGGBB","primary_accent_hex":"#RRGGBB","color_palette":["#RRGGBB","#RRGGBB","#RRGGBB","#RRGGBB"],"typography_rules":"...","core_slogan":"...","imagen_style_conditioning":"Sentence one. Sentence two."}',
        "",
        `Brand Manifesto:\n${manifestoForStructuring}`,
        "",
        `Firecrawl Markdown:\n${markdownForStructuring}`,
        "",
        `Firecrawl Branding JSON:\n${brandingForStructuring}`,
        "",
        `Firecrawl Metadata:\n${metadataForStructuring}`,
        "",
        `Thinking level preference: ${thinkingLevel}.`,
      ].join("\n");
      let finalBrandDna: z.infer<typeof brandDnaSchema>;
      try {
        const structured = await generateObject({
          model: google(structuringModelId),
          schema: brandDnaSchema,
          maxOutputTokens: structuringMaxOutputTokens,
          system:
            "You are a deterministic JSON schema extractor. Return valid JSON only.",
          prompt: structuringPrompt,
        });
        finalBrandDna = structured.object;
      } catch (primaryError) {
        console.error("[omnivorous-brand-extractor] phase_c_generate_object_failed", {
          jobId,
          error: primaryError,
        });
        const fallbackResponse = await generateText({
          model: google(structuringModelId),
          maxOutputTokens: structuringMaxOutputTokens,
          system:
            "Return one JSON object only. No markdown, no prose, no code fences.",
          prompt: structuringPrompt,
        });
        try {
          const parsedFallback = tryParseJsonObject(fallbackResponse.text);
          finalBrandDna = brandDnaSchema.parse(parsedFallback);
        } catch (fallbackParseError) {
          console.error("[omnivorous-brand-extractor] phase_c_fallback_parse_failed", {
            jobId,
            error: fallbackParseError,
          });
          finalBrandDna = buildFallbackBrandDna({
            branding: normalized.branding,
            metadata: normalized.metadata,
            manifesto: brandManifesto,
          });
        }
      }
      console.info("[omnivorous-brand-extractor] phase_c_end", {
        jobId,
        structuringModelId,
        thinkingLevel,
        structuringMaxOutputTokens,
        structuringPromptVersion: STRUCTURING_PROMPT_VERSION,
        structuringPromptChars: structuringPrompt.length,
        inputSizes: {
          manifestoChars: manifestoForStructuring.length,
          markdownChars: markdownForStructuring.length,
          brandingChars: brandingForStructuring.length,
          metadataChars: metadataForStructuring.length,
        },
        finalBrandDna,
      });

      await updateJobPhase(jobId, "processing", "phase_d_database_mutation");

      console.info("[omnivorous-brand-extractor] phase_d_start", { jobId });
      const brandName = deriveBrandName(input, jobId);
      const brandDomain = deriveBrandDomain(input, jobId);
      const rootLogoUrl =
        normalized.assets.find((asset) => asset.kind === "logo")?.url ?? null;
      const { data: brand, error: brandInsertError } = await supabase
        .from("brands")
        .upsert(
          {
            org_id: organizationId,
            domain: brandDomain,
            name: brandName,
            primary_hex: finalBrandDna.primary_background_hex,
            secondary_hex: finalBrandDna.primary_accent_hex,
            logo_url: rootLogoUrl,
            layout_rules: {
              typography_rules: finalBrandDna.typography_rules,
              core_slogan: finalBrandDna.core_slogan,
              imagen_style_conditioning: finalBrandDna.imagen_style_conditioning,
            },
            brand_dna: {
              ...finalBrandDna,
              source: "omnivorous-brand-extractor",
              manifest_excerpt: brandManifesto.slice(0, 2000),
              firecrawl_branding: normalized.branding,
              firecrawl_metadata: normalized.metadata,
              firecrawl_actions: normalized.actions,
              assets: normalized.assets,
            },
          },
          { onConflict: "org_id,domain" }
        )
        .select("id")
        .single();

      if (brandInsertError || !brand) {
        throw new Error(
          `Failed to insert brand record: ${brandInsertError?.message ?? "unknown_error"}`
        );
      }

      await supabase
        .from("jobs")
        .update({
          status: "completed",
          payload: {
            phase: "completed",
            brand_id: brand.id,
            asset_count: normalized.assets.length,
          },
          result_url: `brands/${brand.id}`,
          error_log: null,
        })
        .eq("id", jobId);

      console.info("[omnivorous-brand-extractor] phase_d_end", {
        jobId,
        brandId: brand.id,
      });

      return {
        success: true as const,
        jobId,
        brandId: brand.id,
        brandDna: finalBrandDna,
      };
    } catch (error) {
      const errorLog =
        error instanceof Error
          ? `${error.message}\n${error.stack ?? ""}`
          : "Unknown extraction error";

      console.error("[omnivorous-brand-extractor] failed", {
        jobId,
        organizationId,
        error,
      });

      await updateJobPhase(
        jobId,
        "failed",
        "failed",
        {
          failed_at: new Date().toISOString(),
        },
        errorLog
      );

      throw error;
    }
  },
});
