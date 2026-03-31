import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { huatuoInterpretImage } from "@/lib/health/huatuogpt-client";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import {
  patientRiskWorkflowInputSchema,
} from "@/mastra/workflows/patient-risk/schemas";

function resolveLocale(input: {
  output?: { locale?: string } | undefined;
  context?: Record<string, unknown> | undefined;
}): string | undefined {
  const fromOutput = input.output?.locale?.trim();
  if (fromOutput) return fromOutput;
  const ctx = input.context ?? {};
  const raw = (ctx["locale"] ?? ctx["language"] ?? ctx["lang"]) as unknown;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().slice(0, 32) : undefined;
}

export const step1PatientRiskClassification = createStep({
  id: "patient-risk-step1-input-classification",
  inputSchema: patientRiskWorkflowInputSchema,
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const jobId = inputData.job_id;
    let patientRecord: Record<string, unknown> = {};
    try {
      patientRecord = JSON.parse(inputData.input.input.data) as Record<string, unknown>;
    } catch {
      patientRecord = { parse_error: true, raw_snippet: inputData.input.input.data.slice(0, 500) };
    }
    const locale = resolveLocale({
      output: inputData.input.output,
      context: inputData.input.context,
    });
    const hasImage = Boolean(inputData.input.input.image_data?.trim());
    let vision_narrative: string | undefined;
    const vision_fallbacks: string[] = [];

    if (hasImage && inputData.input.input.image_data) {
      try {
        const huatuo = await huatuoInterpretImage({
          requestId: jobId,
          locale,
          modality: "patient_risk_attachment",
          imageUrlOrData: inputData.input.input.image_data.trim(),
          context: inputData.input.context,
        });
        vision_narrative = [huatuo.narrative, ...huatuo.findings.map((f) => `${f.title}: ${f.summary}`)]
          .filter(Boolean)
          .join(" | ")
          .slice(0, 8000);
      } catch (e) {
        vision_fallbacks.push(e instanceof Error ? e.message : "huatuo_failed");
      }
    }

    let patient_json_for_llm = inputData.input.input.data;
    if (vision_narrative) {
      try {
        const base = JSON.parse(inputData.input.input.data) as Record<string, unknown>;
        patient_json_for_llm = JSON.stringify({
          ...base,
          vision_assisted_notes: vision_narrative,
        });
      } catch {
        patient_json_for_llm = JSON.stringify({
          unstructured_patient_payload: inputData.input.input.data.slice(0, 50_000),
          vision_assisted_notes: vision_narrative,
        });
      }
    }

    return {
      ...inputData,
      step1: {
        locale,
        has_image: hasImage,
        patient_record: patientRecord,
        patient_json: inputData.input.input.data,
        patient_json_for_llm,
        vision_narrative,
        vision_fallbacks,
      },
      diagnostics: [
        ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
        finishDiagnostic({
          step: "step1_input_classification",
          started_at: started,
          status: "ok",
          detail: { has_image: hasImage, vision_used: Boolean(vision_narrative), vision_fallbacks },
        }),
      ],
    } as Record<string, unknown>;
  },
});
