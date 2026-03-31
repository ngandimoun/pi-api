import type { HealthTriageFinding } from "./types";
import { geminiGenerateTreatmentPlan, geminiInterpretForTriage } from "./gemini-fallback";
import { huatuoInterpretImage } from "./huatuogpt-client";
import { medgemmaInterpretFallback, medgemmaGenerateTreatmentPlan } from "./medgemma-client";

export type InterpretationResult = {
  findings: HealthTriageFinding[];
  triage_level: "critical" | "urgent" | "standard" | "low";
  confidence: number;
  narrative: string;
  used: { provider: string; endpoint: string };
};

export async function interpretForTriage(params: {
  requestId: string;
  locale?: string;
  modality: string;
  imageUrlOrData?: string;
  context?: Record<string, unknown>;
  processedSummary?: string;
}): Promise<{ result: InterpretationResult; fallbacks: string[] }> {
  const fallbacks: string[] = [];

  try {
    if (params.imageUrlOrData) {
      const result = await huatuoInterpretImage({
        requestId: params.requestId,
        locale: params.locale,
        modality: params.modality,
        imageUrlOrData: params.imageUrlOrData,
        context: params.context,
      });
      return { result, fallbacks };
    }
  } catch (error) {
    fallbacks.push(error instanceof Error ? error.message : "huatuo_failed");
  }

  try {
    const result = await medgemmaInterpretFallback({
      requestId: params.requestId,
      locale: params.locale,
      modality: params.modality,
      imageUrlOrData: params.imageUrlOrData,
      context: params.context,
      processedSummary: params.processedSummary,
    });
    if (fallbacks.length > 0) {
      fallbacks.push("used_medgemma_fallback");
    }
    return { result, fallbacks };
  } catch (error) {
    fallbacks.push(error instanceof Error ? error.message : "medgemma_failed");
  }

  const result = await geminiInterpretForTriage({
    requestId: params.requestId,
    locale: params.locale,
    modality: params.modality,
    imageUrlOrData: params.imageUrlOrData,
    context: params.context,
    processedSummary: params.processedSummary,
  });
  fallbacks.push("used_gemini_fallback");
  return { result, fallbacks };
}

export async function generatePlan(params: {
  requestId: string;
  locale?: string;
  findings: HealthTriageFinding[];
  seizure_detected?: boolean | null;
  context?: Record<string, unknown>;
}): Promise<{
  treatment_plan: string;
  referral_recommendation?: string;
  red_flags: string[];
  disclaimer: string;
  routing_fallbacks: string[];
}> {
  const routing_fallbacks: string[] = [];

  try {
    const plan = await medgemmaGenerateTreatmentPlan({
      requestId: params.requestId,
      locale: params.locale,
      findings: params.findings,
      seizure_detected: params.seizure_detected,
      context: params.context,
    });
    return {
      treatment_plan: plan.treatment_plan,
      referral_recommendation: plan.referral_recommendation,
      red_flags: plan.red_flags,
      disclaimer: plan.disclaimer,
      routing_fallbacks,
    };
  } catch (error) {
    routing_fallbacks.push(error instanceof Error ? error.message : "medgemma_failed");
  }

  const plan = await geminiGenerateTreatmentPlan({
    requestId: params.requestId,
    locale: params.locale,
    findings: params.findings,
    seizure_detected: params.seizure_detected,
    context: params.context,
  });
  routing_fallbacks.push("used_gemini_fallback");
  return {
    treatment_plan: plan.treatment_plan,
    referral_recommendation: plan.referral_recommendation,
    red_flags: plan.red_flags,
    disclaimer: plan.disclaimer,
    routing_fallbacks,
  };
}
