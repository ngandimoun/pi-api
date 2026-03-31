import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { monaiSegment } from "@/lib/health/monai-client";
import { metabciClassifyEeg } from "@/lib/health/metabci-client";
import { startTimer, finishDiagnostic } from "@/mastra/workflows/health-triage/debug";
import { healthTriageWorkflowInputSchema, step2OutputSchema } from "@/mastra/workflows/health-triage/schemas";

export const step2Processing = createStep({
  id: "health-triage-step2-processing",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const input = inputData.input.input;
    if (input.type === "image") {
      try {
        const result = await monaiSegment({
          input: {
            data: input.data,
            modality: input.modality ?? "image",
            mime_type: input.mime_type,
          },
          requestId: inputData.job_id,
        });

        const step2 = step2OutputSchema.parse({
          segmentation_overlay_url: result.overlay_url ?? null,
          seizure_detected: null,
          processed_summary: result.overlay_url ? "segmentation_overlay_ready" : "segmentation_completed",
        });
        return {
          ...inputData,
          step2,
          diagnostics: [
            ...(inputData as any).diagnostics ?? [],
            finishDiagnostic({
              step: "step2_processing",
              started_at: started,
              status: "ok",
              detail: { path: "image", has_overlay_url: Boolean(step2.segmentation_overlay_url) },
            }),
          ],
        } as any;
      } catch (error) {
        const step2 = step2OutputSchema.parse({
          segmentation_overlay_url: null,
          seizure_detected: null,
          processed_summary: `segmentation_unavailable: ${error instanceof Error ? error.message : "unknown_error"}`,
        });
        return {
          ...inputData,
          step2,
          diagnostics: [
            ...(inputData as any).diagnostics ?? [],
            finishDiagnostic({
              step: "step2_processing",
              started_at: started,
              status: "failed",
              detail: { path: "image", error: error instanceof Error ? error.message : "unknown_error" },
            }),
          ],
        } as any;
      }
    }

    try {
      const result = await metabciClassifyEeg({
        input: { data: input.data, modality: input.modality },
        requestId: inputData.job_id,
      });

      const step2 = step2OutputSchema.parse({
        segmentation_overlay_url: null,
        seizure_detected: result.seizure_detected,
        processed_summary: "eeg_classification_completed",
      });
      return {
        ...inputData,
        step2,
        diagnostics: [
          ...(inputData as any).diagnostics ?? [],
          finishDiagnostic({
            step: "step2_processing",
            started_at: started,
            status: "ok",
            detail: { path: "eeg", seizure_detected: result.seizure_detected },
          }),
        ],
      } as any;
    } catch (error) {
      const step2 = step2OutputSchema.parse({
        segmentation_overlay_url: null,
        seizure_detected: null,
        processed_summary: `eeg_processing_unavailable: ${error instanceof Error ? error.message : "unknown_error"}`,
      });
      return {
        ...inputData,
        step2,
        diagnostics: [
          ...(inputData as any).diagnostics ?? [],
          finishDiagnostic({
            step: "step2_processing",
            started_at: started,
            status: "failed",
            detail: { path: "eeg", error: error instanceof Error ? error.message : "unknown_error" },
          }),
        ],
      } as any;
    }
  },
});

