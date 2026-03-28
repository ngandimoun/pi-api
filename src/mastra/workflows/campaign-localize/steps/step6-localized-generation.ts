import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import type { FlashAspectRatio, AllowedResolution } from "@/lib/avatar/image-config";
import { FLASH_ASPECT_RATIOS } from "@/lib/avatar/image-config";
import { normalizeReferenceImages } from "@/lib/ads/reference-inputs";
import { generateCampaignImage } from "@/lib/campaigns/generate-campaign-image";
import { getCampaignImageModelId } from "@/lib/campaigns/gemini-client";
import { buildPublicAssetUrl, uploadAsset } from "@/lib/storage";
import { runDeterministicQualityGate } from "@/lib/ads/workers";
import { appendInMemoryDiagnostic, appendJobDiagnostic } from "@/mastra/workflows/campaign-localize/diagnostics";
import {
  campaignLocalizeWorkflowOutputSchema,
  step6LocalizeOutputSchema,
} from "@/mastra/workflows/campaign-localize/schemas";

const aspectRatioSet = new Set<string>(FLASH_ASPECT_RATIOS);

function normalizeAspectRatio(value: string): FlashAspectRatio {
  return aspectRatioSet.has(value) ? (value as FlashAspectRatio) : "1:1";
}

function inferAspectRatio(prompt: string): FlashAspectRatio {
  const lower = prompt.toLowerCase();
  if (lower.includes("story") || lower.includes("vertical")) return "9:16";
  if (lower.includes("banner") || lower.includes("landscape")) return "16:9";
  if (lower.includes("poster")) return "3:4";
  return "1:1";
}

function resolveOutput(input: { prompt: string; output?: { aspect_ratio?: string; resolution?: string; thinking_intensity?: "minimal" | "high" } }): {
  aspectRatio: FlashAspectRatio;
  imageSize: AllowedResolution;
  thinkingIntensity?: "minimal" | "high";
} {
  const ar = input.output?.aspect_ratio;
  const aspectRatio = normalizeAspectRatio(ar && ar !== "auto" ? ar : inferAspectRatio(input.prompt));
  const imageSize = (input.output?.resolution ?? "1K") as AllowedResolution;
  return { aspectRatio, imageSize, thinkingIntensity: input.output?.thinking_intensity };
}

export const step6LocalizedGeneration = createStep({
  id: "campaign-localize-step6-localized-generation",
  inputSchema: z.any(),
  outputSchema: campaignLocalizeWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const startedAt = Date.now();
    const output = resolveOutput(inputData.input);

    try {
      // Developer refs (style hints). We reserve slots because we always include:
      // 1) source image (anchor), 2) cultural corpus reference.
      const developerRefs = await normalizeReferenceImages(inputData.input.reference_images, 4);

      const references = [
        {
          buffer: Buffer.from(inputData.step1.source_image.image_base64, "base64"),
          mimeType: inputData.step1.source_image.mime_type,
        },
        {
          buffer: Buffer.from(inputData.step3.corpus_image_base64, "base64"),
          mimeType: inputData.step3.corpus_mime_type,
        },
        ...developerRefs.map((ref) => ({ buffer: ref.buffer, mimeType: ref.mimeType })),
      ].slice(0, 6);

      const imageBuffer = await generateCampaignImage({
        compiledPrompt: inputData.step5.compiled_text_prompt,
        jsonPrompt: inputData.step5.json_prompt,
        references,
        aspectRatio: output.aspectRatio,
        imageSize: output.imageSize,
        thinkingIntensity: output.thinkingIntensity,
      });

      const qualityGate = runDeterministicQualityGate({
        imageBuffer,
        expectedAspectRatio: output.aspectRatio,
        minBytes: Number(process.env.PI_ADS_DETERMINISTIC_MIN_BYTES ?? "12000"),
      });

      if (!qualityGate.pass) {
        throw new Error(`quality_gate_failed: ${qualityGate.reasons.join(",")}`);
      }

      const key = `campaigns/${inputData.organization_id}/${inputData.job_id}.png`;
      await uploadAsset(imageBuffer, key, "image/png");
      const resultUrl = buildPublicAssetUrl(key);

      const step6 = step6LocalizeOutputSchema.parse({
        result_url: resultUrl,
        preview_url: resultUrl,
        image_size_bytes: imageBuffer.length,
        generation_model: getCampaignImageModelId(),
      });
      const diagnostic = {
        step: "campaign-localize-step6-localized-generation",
        status: "ok" as const,
        duration_ms: Date.now() - startedAt,
        detail: {
          image_size_bytes: step6.image_size_bytes,
          generation_model: step6.generation_model,
          result_url: step6.result_url,
        },
      };
      const diagnostics = appendInMemoryDiagnostic(inputData as Record<string, unknown>, diagnostic);
      await appendJobDiagnostic({
        jobId: inputData.job_id,
        diagnostic,
        phase: "completed",
      });

      return campaignLocalizeWorkflowOutputSchema.parse({
        ...step6,
        diagnostics,
      });
    } catch (error) {
      const diagnostic = {
        step: "campaign-localize-step6-localized-generation",
        status: "failed" as const,
        duration_ms: Date.now() - startedAt,
        detail: {
          error: error instanceof Error ? error.message : "step_failed",
        },
      };
      await appendJobDiagnostic({
        jobId: inputData.job_id,
        diagnostic,
        phase: "failed",
      });
      throw error;
    }
  },
});

