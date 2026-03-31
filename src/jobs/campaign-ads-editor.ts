import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { imageSize } from "image-size";

import { campaignAdEditInputSchema, type CampaignAdEditInput } from "../contracts/campaign-ads-edit-api";
import { editCampaignImage } from "../lib/campaigns/edit-campaign-image";
import { getServiceSupabaseClient } from "../lib/supabase";
import { buildPublicAssetUrl, uploadAsset } from "../lib/storage";
import { runDeterministicQualityGate } from "../lib/ads/workers";
import { normalizeReferenceImages, type NormalizedReferenceImage } from "../lib/ads/reference-inputs";
import { FLASH_ASPECT_RATIOS, type FlashAspectRatio } from "../lib/avatar/image-config";

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: campaignAdEditInputSchema,
});

async function updateCampaignEditJob(
  jobId: string,
  status: "processing" | "completed" | "failed",
  payload: Record<string, unknown>,
  errorLog?: string | null,
  resultUrl?: string | null
) {
  const supabase = getServiceSupabaseClient();
  await supabase
    .from("jobs")
    .update({
      status,
      payload,
      error_log: errorLog ?? null,
      result_url: resultUrl ?? null,
    })
    .eq("id", jobId);
}

function inferAspectRatioFromBuffer(buffer: Buffer): FlashAspectRatio {
  const dimensions = imageSize(buffer);
  if (!dimensions.width || !dimensions.height) return "1:1";
  const ratio = dimensions.width / dimensions.height;

  let best: FlashAspectRatio = FLASH_ASPECT_RATIOS[0] as FlashAspectRatio;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const ar of FLASH_ASPECT_RATIOS) {
    const [wRaw, hRaw] = ar.split(":");
    const w = Number(wRaw);
    const h = Number(hRaw);
    if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) continue;
    const target = w / h;
    const diff = Math.abs(ratio - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ar as FlashAspectRatio;
    }
  }

  return best;
}

function resolveEditOutput(input: CampaignAdEditInput, sourceImageBuffer: Buffer): {
  aspectRatio: FlashAspectRatio;
  imageSize: string;
  thinkingIntensity?: "minimal" | "high";
} {
  const desired = input.output?.aspect_ratio;
  const aspectRatio =
    desired && desired !== "auto" ? (desired as FlashAspectRatio) : inferAspectRatioFromBuffer(sourceImageBuffer);

  return {
    aspectRatio,
    imageSize: input.output?.resolution ?? "1K",
    thinkingIntensity: input.output?.thinking_intensity,
  };
}

function toSourceImageReference(buffer: Buffer): NormalizedReferenceImage {
  // Campaign ad images are uploaded as PNG; we keep the mimeType consistent for Gemini.
  return { buffer, mimeType: "image/png", source: "developer_upload" };
}

export const campaignAdsEditor = task({
  id: "campaign-ads-editor",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsed;

    await updateCampaignEditJob(jobId, "processing", {
      phase: "edit_processing",
      source_job_id: input.source_job_id,
      input: {
        prompt: input.prompt,
        reference_image_count: input.reference_images?.length ?? 0,
        output: input.output ?? undefined,
        client_reference_id: input.client_reference_id ?? undefined,
        metadata: input.metadata ?? undefined,
      },
    });

    const supabase = getServiceSupabaseClient();

    const { data: sourceJob, error: sourceJobError } = await supabase
      .from("jobs")
      .select("type,status,payload,org_id")
      .eq("id", input.source_job_id)
      .maybeSingle();

    if (sourceJobError || !sourceJob || String(sourceJob.org_id) !== organizationId) {
      await updateCampaignEditJob(jobId, "failed", { phase: "failed", failure_code: "source_job_not_found" });
      throw new Error("source_job_not_found");
    }

    if (sourceJob.type !== "campaign_ad_generation" && sourceJob.type !== "campaign_ad_edit") {
      await updateCampaignEditJob(jobId, "failed", { phase: "failed", failure_code: "source_job_type_invalid" });
      throw new Error("source_job_type_invalid");
    }

    if (sourceJob.status !== "completed") {
      await updateCampaignEditJob(jobId, "failed", { phase: "failed", failure_code: "source_job_not_completed" });
      throw new Error("source_job_not_completed");
    }

    const sourcePayload = sourceJob.payload as Record<string, unknown> | null | undefined;
    const sourceImageUrl = sourcePayload?.image_url;
    if (typeof sourceImageUrl !== "string") {
      await updateCampaignEditJob(jobId, "failed", { phase: "failed", failure_code: "source_job_missing_image" });
      throw new Error("source_job_missing_image");
    }

    // Download the canonical source image from R2 public URL.
    const sourceRes = await fetch(sourceImageUrl);
    if (!sourceRes.ok) {
      await updateCampaignEditJob(jobId, "failed", { phase: "failed", failure_code: "source_image_download_failed" });
      throw new Error(`source_image_download_failed:${sourceRes.status}`);
    }
    const sourceArrayBuffer = await sourceRes.arrayBuffer();
    const sourceBuffer = Buffer.from(sourceArrayBuffer);
    const sourceRef = toSourceImageReference(sourceBuffer);

    const developerRefs = await normalizeReferenceImages(input.reference_images, 5);

    const { aspectRatio, imageSize, thinkingIntensity } = resolveEditOutput(input, sourceBuffer);

    try {
      const editedBuffer = await editCampaignImage({
        source: sourceRef,
        editPrompt: input.prompt,
        references: developerRefs,
        aspectRatio,
        imageSize,
        thinkingIntensity,
      });

      const qualityGate = runDeterministicQualityGate({
        imageBuffer: editedBuffer,
        expectedAspectRatio: aspectRatio,
        minBytes: Number(process.env.PI_ADS_DETERMINISTIC_MIN_BYTES ?? "12000"),
      });

      if (!qualityGate.pass) {
        throw new Error(`quality_gate_failed: ${qualityGate.reasons.join(",")}`);
      }

      const key = `campaigns/${organizationId}/${jobId}.png`;
      await uploadAsset(editedBuffer, key, "image/png");
      const resultUrl = buildPublicAssetUrl(key);

      await updateCampaignEditJob(
        jobId,
        "completed",
        {
          phase: "completed",
          image_url: resultUrl,
          source_job_id: input.source_job_id,
          diagnostics: [],
        },
        null,
        resultUrl
      );

      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.completed",
        jobId,
      });

      return {
        status: "completed" as const,
        result_url: resultUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : "campaign_edit_failed";
      await updateCampaignEditJob(
        jobId,
        "failed",
        {
          phase: "failed",
          failure_code: "internal_step_failed",
        },
        message
      );
      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.failed",
        jobId,
      });
      throw error;
    }
  },
});

