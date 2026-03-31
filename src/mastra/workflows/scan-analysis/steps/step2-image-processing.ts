import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { monaiSegment } from "@/lib/health/monai-client";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step2ScanMonai = createStep({
  id: "scan-analysis-step2-image-processing",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const s1 = raw.step1 as { resolved_image_url: string; modality: string };

    try {
      const result = await monaiSegment({
        input: {
          data: s1.resolved_image_url,
          modality: s1.modality,
        },
        requestId: jobId,
      });
      return {
        ...raw,
        step2: {
          segmentation_overlay_url: result.overlay_url ?? null,
          processed_summary: result.overlay_url ? "segmentation_overlay_ready" : "segmentation_completed",
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_image_processing",
            started_at: started,
            status: "ok",
            detail: { has_overlay: Boolean(result.overlay_url) },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step2: {
          segmentation_overlay_url: null,
          processed_summary: `monai_unavailable: ${error instanceof Error ? error.message : "error"}`,
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_image_processing",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
