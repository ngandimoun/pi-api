import { task, tasks } from "@trigger.dev/sdk/v3";
import crypto from "crypto";
import { z } from "zod";

import { adGenerationInputSchema, type AdGenerationInput } from "../contracts/ads-api";
import { buildArtifactCacheKey, getArtifactCache, setArtifactCache } from "../lib/ads/artifact-cache";
import { resolveBrandConditioning } from "../lib/ads/brand-conditioning";
import { buildInitialDirective, pushDirectiveStep } from "../lib/ads/directive";
import { AdImageGenerationError, generateAdImage } from "../lib/ads/image-generate";
import { resolveAdImageOutput } from "../lib/ads/image-output";
import { enforceDirectivePolicies } from "../lib/ads/policy-engine";
import { compileAdPrompt } from "../lib/ads/prompt-compiler";
import { normalizeReferenceImages } from "../lib/ads/reference-inputs";
import { CorpusReferenceNotFoundError, retrieveAdCorpusReference } from "../lib/ads/retrieve-reference";
import {
  evaluateGeneratedAd,
  classifyDifficulty,
  extractCopySlots,
  runCreativePlanner,
  runDeterministicQualityGate,
  runPromptUnderstanding,
  summarizeImages,
  validateCopySlots,
} from "../lib/ads/workers";
import { uploadAsset } from "../lib/storage";
import { getServiceSupabaseClient } from "../lib/supabase";

const triggerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  input: adGenerationInputSchema,
});

function digest(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function bufferDigest(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function envMs(name: string, fallback: number): number {
  const parsed = Number(process.env[name] ?? String(fallback));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name] ?? String(fallback));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assertBudget(startMs: number, code: string) {
  const elapsed = Date.now() - startMs;
  const stageBudget = envMs("PI_ADS_STAGE_MAX_MS", 240000);
  if (elapsed > stageBudget) {
    throw new Error(`${code}: stage exceeded budget (${elapsed}ms > ${stageBudget}ms).`);
  }
}

function assertRunBudget(runStartedAt: number) {
  const maxRunMs = envMs("PI_ADS_MAX_RUN_MS", 480000);
  const elapsed = Date.now() - runStartedAt;
  if (elapsed > maxRunMs) {
    throw new Error(`budget_exceeded: end-to-end runtime budget exceeded (${elapsed}ms > ${maxRunMs}ms).`);
  }
}

async function updateAdJob(
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

function sanitizeInputForPayload(input: AdGenerationInput) {
  return {
    prompt: input.prompt,
    output: input.output ?? undefined,
    reference_image_count: input.reference_images?.length ?? 0,
    has_brand_id: Boolean(input.brand_id),
    has_brand_identity_json: Boolean(input.brand_identity_json),
    client_reference_id: input.client_reference_id ?? undefined,
    metadata: input.metadata ?? undefined,
  };
}

function createFailurePayload(input: AdGenerationInput, code: string, message: string) {
  return {
    phase: "failed",
    failure_code: code,
    message,
    input: sanitizeInputForPayload(input),
    failed_at: new Date().toISOString(),
  };
}

function formatAdError(error: unknown): { code: string; message: string } {
  if (error instanceof CorpusReferenceNotFoundError) {
    return { code: "retrieval_failed", message: error.message };
  }
  if (error instanceof AdImageGenerationError) {
    if (error.code === "generation_blocked") return { code: "generation_blocked", message: error.message };
    if (error.code === "generation_empty") return { code: "generation_empty", message: error.message };
  }
  if (error instanceof z.ZodError) {
    return { code: "directive_validation_failed", message: error.issues[0]?.message ?? "Invalid directive output." };
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("brand_id not found")) return { code: "policy_conflict", message: error.message };
    if (lower.includes("reference image")) return { code: "reference_input_invalid", message: error.message };
    if (lower.includes("quality_gate_failed")) return { code: "quality_gate_failed", message: error.message };
    if (lower.includes("retrieval")) return { code: "retrieval_failed", message: error.message };
    if (lower.includes("budget_exceeded")) return { code: "budget_exceeded", message: error.message };
    return { code: "internal_step_failed", message: error.message };
  }
  return { code: "internal_step_failed", message: "ads_job_failed" };
}

function preGenerationQualityGate(compiledPrompt: string) {
  if (compiledPrompt.length < 250) {
    throw new Error("creative_plan_invalid: compiled prompt too short for ad quality.");
  }
}

function buildRevisionDirectives(params: {
  minScore: number;
  evaluation: {
    ad_clarity: number;
    cta_visibility: number;
    language_correctness: number;
    cultural_fit: number;
    product_prominence: number;
  };
  languageCode: string;
  market: string;
}): string[] {
  const directives: string[] = [];
  const threshold = Math.max(40, Math.floor(params.minScore - 8));
  if (params.evaluation.ad_clarity < threshold) {
    directives.push("Improve overall ad clarity and visual hierarchy.");
  }
  if (params.evaluation.cta_visibility < threshold) {
    directives.push("Increase CTA prominence, contrast, and readability.");
  }
  if (params.evaluation.language_correctness < threshold) {
    directives.push(`Fix all on-image text to be fully correct in ${params.languageCode}.`);
  }
  if (params.evaluation.cultural_fit < threshold) {
    directives.push(`Improve cultural fit for ${params.market} while keeping product intent.`);
  }
  if (params.evaluation.product_prominence < threshold) {
    directives.push("Make product the dominant focal point.");
  }
  return directives;
}

export const adsCreator = task({
  id: "ads-creator",
  run: async (payload) => {
    const parsed = triggerPayloadSchema.parse(payload);
    const { jobId, organizationId, input } = parsed;
    const runStartedAt = Date.now();
    const allowModelEvaluatorForFastPath =
      (process.env.PI_ADS_FAST_PATH_MODEL_EVAL ?? "false").toLowerCase() === "true";
    const deterministicMinBytes = envMs("PI_ADS_DETERMINISTIC_MIN_BYTES", 12000);
    const maxRevisionAttempts = Math.floor(envNumber("PI_ADS_MAX_REVISION_ATTEMPTS", 1));

    await updateAdJob(jobId, "processing", {
      phase: "prompt_understanding",
      input: sanitizeInputForPayload(input),
    });

    try {
      const difficulty = classifyDifficulty(input);
      const requestFingerprint = digest(
        JSON.stringify({
          prompt: input.prompt,
          refs: input.reference_images ?? [],
          brand_id: input.brand_id ?? null,
          has_inline_brand: Boolean(input.brand_identity_json),
          output: input.output ?? null,
        })
      );

      const understandingCacheKey = buildArtifactCacheKey("ads_prompt_understanding", {
        v: 1,
        requestFingerprint,
      });
      let promptUnderstanding =
        await getArtifactCache<Awaited<ReturnType<typeof runPromptUnderstanding>>>(
          understandingCacheKey
        );
      if (!promptUnderstanding) {
        const stageStart = Date.now();
        promptUnderstanding = await runPromptUnderstanding(input);
        await setArtifactCache(understandingCacheKey, promptUnderstanding);
        assertBudget(stageStart, "budget_exceeded_prompt_understanding");
      }
      assertRunBudget(runStartedAt);

      const copySlots = extractCopySlots(input);

      const normalizedRefs = await normalizeReferenceImages(input.reference_images);
      await updateAdJob(jobId, "processing", {
        phase: "reference_understanding",
        input: sanitizeInputForPayload(input),
        reference_image_count: normalizedRefs.length,
        route_tier: difficulty.tier,
        route_reasons: difficulty.reasons,
      });

      const retrievalStart = Date.now();
      const corpus = await retrieveAdCorpusReference(input, promptUnderstanding.target_market || null);
      const corpusReference = corpus.reference;
      const corpusDiagnostics = corpus.diagnostics;
      assertBudget(retrievalStart, "budget_exceeded_retrieval");
      assertRunBudget(runStartedAt);

      console.info("[ads.retrieve] selected", {
        jobId,
        orgId: organizationId,
        tier: corpusDiagnostics.tier,
        selected_id: corpusDiagnostics.selected_id,
        candidates: corpusDiagnostics.candidates.slice(0, 3),
      });

      const summaryCacheKey = buildArtifactCacheKey("ads_image_summary", {
        v: 1,
        requestFingerprint,
        corpus_ref_id: corpusReference.row.id,
      });
      let uploadedSummary = await getArtifactCache<string>(summaryCacheKey);
      if (!uploadedSummary) {
        const summaryStart = Date.now();
        uploadedSummary =
          difficulty.tier === "fast_path"
            ? "fast_path_summary: skipped model image summarization for latency budget."
            : await summarizeImages(normalizedRefs, corpusReference);
        await setArtifactCache(summaryCacheKey, uploadedSummary);
        assertBudget(summaryStart, "budget_exceeded_image_summary");
      }
      const brandConditioning = await resolveBrandConditioning({
        input,
        organizationId,
      });

      await updateAdJob(jobId, "processing", {
        phase: "creative_planner",
        input: sanitizeInputForPayload(input),
        has_corpus_reference: true,
        retrieval_diagnostics: corpusDiagnostics,
      });

      const plannerCacheKey = buildArtifactCacheKey("ads_creative_planner", {
        v: 1,
        requestFingerprint,
        prompt_understanding: promptUnderstanding,
        uploadedSummary,
        corpus_ref_id: corpusReference.row.id,
        brand_constraints: brandConditioning.constraints,
        route_tier: difficulty.tier,
      });
      let planner = await getArtifactCache<Awaited<ReturnType<typeof runCreativePlanner>>>(
        plannerCacheKey
      );
      if (!planner) {
        const plannerStart = Date.now();
        planner = await runCreativePlanner({
          input,
          promptUnderstanding,
          uploadedSummary,
          corpusReference,
          brandConstraints: brandConditioning.constraints,
        });
        await setArtifactCache(plannerCacheKey, planner);
        assertBudget(plannerStart, "budget_exceeded_creative_planner");
      }
      assertRunBudget(runStartedAt);

      console.info("[ads.plan] ok", {
        jobId,
        orgId: organizationId,
        market: promptUnderstanding.target_market,
        language: promptUnderstanding.language_code,
        includeHuman: promptUnderstanding.include_human,
        routeTier: difficulty.tier,
      });

      const output = resolveAdImageOutput(input);
      let directive = buildInitialDirective({
        input,
        inferredObjective: promptUnderstanding.inferred_objective,
        productFocus: promptUnderstanding.product_focus,
        targetMarket: promptUnderstanding.target_market,
        languageCode: promptUnderstanding.language_code,
        includeHuman: promptUnderstanding.include_human,
        copySlots,
        uploadedSummary,
        corpusReference,
        creativePlan: {
          headline_idea: planner.headline_idea,
          layout_intent: planner.layout_intent,
          audience_signal: planner.audience_signal,
          cta_strategy: planner.cta_strategy,
          visual_hierarchy: planner.visual_hierarchy,
        },
        scriptNotes: planner.script_notes,
        culturalNotes: planner.cultural_notes,
        brandConstraints: brandConditioning.constraints,
        brandActive: brandConditioning.active,
      });

      directive.generation_config.aspect_ratio = output.aspectRatio;
      directive.generation_config.resolution = output.imageSize;
      directive.generation_config.thinking_intensity = output.thinkingIntensity;

      pushDirectiveStep(directive, {
        step_id: "corpus_retrieval",
        status: "ok",
        confidence: 1,
        artifacts: {
          tier: corpusDiagnostics.tier,
          selected_id: corpusDiagnostics.selected_id,
          candidates_top: corpusDiagnostics.candidates.slice(0, 8),
        },
      });
      pushDirectiveStep(directive, {
        step_id: "copy_slot_extraction",
        status: "ok",
        confidence: copySlots.length > 0 ? 0.85 : 0.6,
        artifacts: { slots: copySlots },
      });
      pushDirectiveStep(directive, {
        step_id: "creative_planner",
        status: "ok",
        confidence: 0.8,
        artifacts: { plan: planner, route_tier: difficulty.tier, route_reasons: difficulty.reasons },
      });

      directive = enforceDirectivePolicies(directive);
      pushDirectiveStep(directive, {
        step_id: "policy_engine",
        status: "ok",
        confidence: 1,
        artifacts: {
          language_code: directive.culture_language_script_plan.language_code,
          brand_constraints_applied: directive.brand_policy_plan.constraints.length,
        },
      });

      await updateAdJob(jobId, "processing", {
        phase: "prompt_compilation",
        input: sanitizeInputForPayload(input),
      });

      const compiledPrompt = compileAdPrompt(directive);
      preGenerationQualityGate(compiledPrompt);
      pushDirectiveStep(directive, {
        step_id: "pre_generation_quality_gate",
        status: "ok",
        confidence: 0.9,
        artifacts: {
          compiled_prompt_chars: compiledPrompt.length,
          compiled_prompt: compiledPrompt.slice(0, 6000),
          compiled_prompt_truncated: compiledPrompt.length > 6000,
        },
      });

      // HARD INVARIANT: must include at least one corpus image reference.
      const generationRefs = [
        { buffer: corpusReference.imageBytes, mimeType: corpusReference.mimeType },
        ...normalizedRefs.map((item) => ({ buffer: item.buffer, mimeType: item.mimeType })),
      ].slice(0, 6);

      if (generationRefs.length === 0) {
        throw new Error("retrieval_failed: missing_corpus_reference");
      }
      if (generationRefs[0]?.buffer !== corpusReference.imageBytes) {
        throw new Error("retrieval_failed: corpus_reference_not_first");
      }

      console.info("[ads.refs] composed", {
        jobId,
        orgId: organizationId,
        corpus_id: corpusReference.row.id,
        developer_ref_count: normalizedRefs.length,
        final_ref_count: generationRefs.length,
      });

      pushDirectiveStep(directive, {
        step_id: "reference_provenance",
        status: "ok",
        confidence: 1,
        artifacts: {
          corpus: {
            id: corpusReference.row.id,
            retrieval_tier: corpusDiagnostics.tier,
            candidates_top: corpusDiagnostics.candidates.slice(0, 5),
          },
          developer_ref_count: normalizedRefs.length,
          final_reference_order: [
            { source: "corpus", id: corpusReference.row.id },
            ...normalizedRefs.map((_, idx) => ({ source: "developer", index: idx })),
          ].slice(0, generationRefs.length),
        },
      });

      let imageBuffer = await generateAdImage({
        prompt: compiledPrompt,
        references: generationRefs,
        aspectRatio: directive.generation_config.aspect_ratio,
        imageSize: directive.generation_config.resolution,
        thinkingIntensity: directive.generation_config.thinking_intensity,
      });
      assertRunBudget(runStartedAt);

      console.info("[ads.generate] ok", {
        jobId,
        orgId: organizationId,
        aspectRatio: directive.generation_config.aspect_ratio,
        resolution: directive.generation_config.resolution,
      });

      const deterministicGate = runDeterministicQualityGate({
        imageBuffer,
        expectedAspectRatio: directive.generation_config.aspect_ratio,
        minBytes: deterministicMinBytes,
      });
      pushDirectiveStep(directive, {
        step_id: "deterministic_gate",
        status: deterministicGate.pass ? "ok" : "retryable_error",
        confidence: deterministicGate.pass ? 0.9 : 0.6,
        artifacts: { reasons: deterministicGate.reasons },
      });

      console.info("[ads.eval] deterministic_gate", {
        jobId,
        orgId: organizationId,
        pass: deterministicGate.pass,
        reasons: deterministicGate.reasons,
      });

      const shouldRunModelEvaluator =
        difficulty.tier === "hard_path" ||
        !deterministicGate.pass ||
        (difficulty.tier === "standard_path") ||
        allowModelEvaluatorForFastPath;

      const defaultEvaluation = {
        ad_clarity: 85,
        cta_visibility: 85,
        language_correctness: 85,
        cultural_fit: 85,
        product_prominence: 85,
        summary: "deterministic_gate_pass",
        total_score: 85,
      };

      const evaluatorCacheKey = buildArtifactCacheKey("ads_evaluator", {
        v: 1,
        requestFingerprint,
        directive_version: directive.directive_version,
        image_digest: bufferDigest(imageBuffer),
        shouldRunModelEvaluator,
      });
      let evaluation = await getArtifactCache<typeof defaultEvaluation>(evaluatorCacheKey);
      if (!evaluation) {
        evaluation = shouldRunModelEvaluator
          ? await evaluateGeneratedAd({
              directive,
              imageBuffer,
              mimeType: "image/png",
            })
          : defaultEvaluation;
        await setArtifactCache(evaluatorCacheKey, evaluation);
      }

      console.info("[ads.eval] score", {
        jobId,
        orgId: organizationId,
        score: evaluation.total_score,
        min_score: directive.quality_targets.min_score,
        shouldRunModelEvaluator,
      });

      let revisionAttempts = 0;
      if (
        evaluation.total_score < directive.quality_targets.min_score &&
        maxRevisionAttempts > 0 &&
        shouldRunModelEvaluator
      ) {
        revisionAttempts += 1;
        const revisionDirectives = buildRevisionDirectives({
          minScore: directive.quality_targets.min_score,
          evaluation,
          languageCode: directive.culture_language_script_plan.language_code,
          market: directive.request_intent.target_market,
        });
        const revisedPrompt = `${compiledPrompt}

REVISION_PASS:
${revisionDirectives.map((line) => `- ${line}`).join("\n")}`;

        imageBuffer = await generateAdImage({
          prompt: revisedPrompt,
          references: generationRefs,
          aspectRatio: directive.generation_config.aspect_ratio,
          imageSize: directive.generation_config.resolution,
          thinkingIntensity: directive.generation_config.thinking_intensity,
        });
        evaluation = await evaluateGeneratedAd({
          directive,
          imageBuffer,
          mimeType: "image/png",
        });
        assertRunBudget(runStartedAt);
      }

      if (evaluation.total_score < directive.quality_targets.min_score) {
        throw new Error("quality_gate_failed: generated ad did not reach minimum score.");
      }

      let copySlotValidation = await validateCopySlots({
        directive,
        imageBuffer,
        mimeType: "image/png",
      });
      pushDirectiveStep(directive, {
        step_id: "copy_slot_validation",
        status: copySlotValidation.pass ? "ok" : "retryable_error",
        confidence: copySlotValidation.pass ? 0.9 : 0.55,
        artifacts: copySlotValidation,
      });

      if (!copySlotValidation.pass && revisionAttempts < maxRevisionAttempts) {
        revisionAttempts += 1;
        const slotFixPrompt = `${compiledPrompt}

REVISION_PASS_COPY_SLOT_FIX:
${copySlotValidation.violations
  .map((item) => `- Fix ${item.slot_type} in ${item.language}: ${item.reason}`)
  .join("\n")}`;
        imageBuffer = await generateAdImage({
          prompt: slotFixPrompt,
          references: generationRefs,
          aspectRatio: directive.generation_config.aspect_ratio,
          imageSize: directive.generation_config.resolution,
          thinkingIntensity: directive.generation_config.thinking_intensity,
        });
        copySlotValidation = await validateCopySlots({
          directive,
          imageBuffer,
          mimeType: "image/png",
        });
        pushDirectiveStep(directive, {
          step_id: "copy_slot_validation_revision",
          status: copySlotValidation.pass ? "ok" : "fatal_error",
          confidence: copySlotValidation.pass ? 0.85 : 0.5,
          artifacts: copySlotValidation,
          ...(copySlotValidation.pass
            ? {}
            : {
                failure_code: "quality_gate_failed",
                recovery_hint: "Adjust requested multilingual copy slots or simplify per-slot copy.",
              }),
        });
      }

      if (!copySlotValidation.pass) {
        throw new Error(
          `quality_gate_failed: copy_slot_violation: ${copySlotValidation.violations
            .map((v) => `${v.slot_type}:${v.language}`)
            .join(", ")}`
        );
      }

      const key = `ads/${organizationId}/${jobId}.png`;
      const imageUrl = await uploadAsset(imageBuffer, key, "image/png");

      await updateAdJob(
        jobId,
        "completed",
        {
          phase: "completed",
          input: sanitizeInputForPayload(input),
          image_url: imageUrl,
          output_applied: {
            aspect_ratio: directive.generation_config.aspect_ratio,
            resolution: directive.generation_config.resolution,
            ...(directive.generation_config.thinking_intensity
              ? { thinking_intensity: directive.generation_config.thinking_intensity }
              : {}),
          },
          evaluator: evaluation,
          route_tier: difficulty.tier,
          route_reasons: difficulty.reasons,
          budget: {
            run_elapsed_ms: Date.now() - runStartedAt,
            max_run_ms: envMs("PI_ADS_MAX_RUN_MS", 480000),
            stage_max_ms: envMs("PI_ADS_STAGE_MAX_MS", 240000),
            revision_attempts: revisionAttempts,
            max_revision_attempts: maxRevisionAttempts,
          },
          directive_version: directive.directive_version,
          diagnostics: directive.diagnostics.steps,
        },
        null,
        `ads/${jobId}`
      );

      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.completed",
        jobId,
      });

      return { success: true as const, jobId, imageUrl };
    } catch (error) {
      const formatted = formatAdError(error);
      const errorLog =
        error instanceof Error ? `${formatted.code}: ${error.message}\n${error.stack ?? ""}` : formatted.message;

      await updateAdJob(
        jobId,
        "failed",
        createFailurePayload(input, formatted.code, formatted.message),
        errorLog
      );

      console.error("[ads.fail]", {
        jobId,
        orgId: organizationId,
        code: formatted.code,
        message: formatted.message,
      });

      await tasks.trigger("webhook-delivery", {
        orgId: organizationId,
        event: "job.failed",
        jobId,
      });

      throw error;
    }
  },
});

