import { task, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import {
  avatarGenerationInputSchema,
  type AvatarGenerationInput,
} from "../contracts/avatar-api";
import {
  generateAvatarImage,
  ImageGenerationError,
  type ReferencePart,
} from "../lib/avatar/image-generate";
import {
  resolveImageOutput,
  thinkingLevelToPublic,
} from "../lib/avatar/image-output";
import { buildAvatarImagePrompt } from "../lib/avatar/prompt-orchestrator";
import {
  MAX_MODEL_REFERENCE_IMAGES,
  normalizeReferenceImages,
} from "../lib/avatar/reference-inputs";
import { retrieveCorpusReference } from "../lib/avatar/retrieve-reference";
import { uploadAsset } from "../lib/storage";
import { getServiceSupabaseClient } from "../lib/supabase";

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: avatarGenerationInputSchema,
});

async function updateAvatarJob(
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

function formatAvatarJobError(error: unknown): string {
  if (error instanceof ImageGenerationError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ""}`;
  }
  return "avatar_job_failed";
}

export const avatarCreator = task({
  id: "avatar-creator",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsed;

    try {
      console.info("[avatar.retrieve] start", {
        job_id: jobId,
        org_id: organizationId,
        has_client_refs: (input.reference_images?.length ?? 0) > 0,
      });

      await updateAvatarJob(jobId, "processing", {
        phase: "processing",
        input: sanitizeInputForPayload(input),
      });

      const hasClientRefs = (input.reference_images?.length ?? 0) > 0;
      let references: ReferencePart[] = [];
      let corpusRow = null;

      if (hasClientRefs) {
        const normalized = normalizeReferenceImages(
          input.reference_images,
          MAX_MODEL_REFERENCE_IMAGES
        );
        references = normalized.map((r) => ({
          buffer: r.buffer,
          mimeType: r.mimeType,
        }));
      } else {
        const corpus = await retrieveCorpusReference(input);
        if (corpus) {
          corpusRow = corpus.row;
          references = [
            {
              buffer: corpus.imageBytes,
              mimeType: corpus.mimeType,
            },
          ];
        }
      }

      console.info("[avatar.refs] composed", {
        job_id: jobId,
        org_id: organizationId,
        mode: hasClientRefs ? "client_refs" : "corpus",
        corpus_id: corpusRow?.id ?? null,
        reference_count: references.length,
        first_ref_is_corpus: hasClientRefs ? null : references.length > 0,
      });

      if (!hasClientRefs && references.length === 0) {
        throw new Error("retrieval_failed: missing_corpus_reference_for_avatar");
      }

      const masterPrompt = await buildAvatarImagePrompt({
        input,
        mode: hasClientRefs ? "client_refs" : "corpus",
        corpusRow: corpusRow ?? undefined,
        clientRefDigest: hasClientRefs
          ? `${references.length} developer reference image(s) supplied.`
          : undefined,
      });

      console.info("[avatar.plan] prompt_ready", {
        job_id: jobId,
        org_id: organizationId,
        mode: hasClientRefs ? "client_refs" : "corpus",
        corpus_id: corpusRow?.id ?? null,
      });

      const resolved = resolveImageOutput(input);
      const genStart = Date.now();
      const imageBuffer = await generateAvatarImage({
        prompt: masterPrompt,
        references,
        aspectRatio: resolved.aspectRatio,
        imageSize: resolved.imageSize,
        thinkingLevel: resolved.thinkingLevel,
      });
      console.info("[avatar.generate] ok", {
        job_id: jobId,
        org_id: organizationId,
        elapsed_ms: Date.now() - genStart,
        reference_count: references.length,
      });

      const key = `avatars/${organizationId}/${jobId}.png`;
      const imageUrl = await uploadAsset(imageBuffer, key, "image/png");

      await updateAvatarJob(
        jobId,
        "completed",
        {
          phase: "completed",
          input: sanitizeInputForPayload(input),
          image_url: imageUrl,
          mode: hasClientRefs ? "client_refs" : "corpus",
          output_applied: {
            aspect_ratio: resolved.aspectRatio,
            resolution: resolved.imageSize,
            ...(thinkingLevelToPublic(resolved.thinkingLevel)
              ? { thinking_intensity: thinkingLevelToPublic(resolved.thinkingLevel) }
              : {}),
          },
        },
        null,
        `avatars/${jobId}`
      );

      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.completed",
        jobId,
      });

      return { success: true as const, jobId, imageUrl };
    } catch (error) {
      const errorLog = formatAvatarJobError(error);

      console.error("[avatar.fail] failed", { job_id: jobId, org_id: organizationId, error });

      await updateAvatarJob(
        jobId,
        "failed",
        {
          phase: "failed",
          input: sanitizeInputForPayload(parsed.input),
          failed_at: new Date().toISOString(),
        },
        errorLog,
        null
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

/** Strip heavy base64 from stored job payload. */
function sanitizeInputForPayload(input: AvatarGenerationInput) {
  return {
    prompt: input.prompt,
    hints: input.hints ?? undefined,
    output: input.output ?? undefined,
    reference_image_count: input.reference_images?.length ?? 0,
    client_reference_id: input.client_reference_id ?? undefined,
    metadata: input.metadata ?? undefined,
  };
}