import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { interpretForTriage } from "@/lib/health/model-router";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step3ScanInterpret = createStep({
  id: "scan-analysis-step3-finding-synthesis",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const s1 = raw.step1 as {
      resolved_image_url: string;
      modality: string;
      locale?: string;
      clinical_question?: string;
    };
    const s2 = raw.step2 as { processed_summary?: string };

    const context = {
      ...(input.context ?? {}),
      ...(s2.processed_summary ? { monai_processing: s2.processed_summary } : {}),
      ...(s1.clinical_question ? { clinical_question: s1.clinical_question } : {}),
    };

    try {
      const { result, fallbacks } = await interpretForTriage({
        requestId: jobId,
        locale: input.output?.locale ?? s1.locale,
        modality: s1.modality,
        imageUrlOrData: s1.resolved_image_url,
        context,
        processedSummary: s2.processed_summary,
      });

      return {
        ...raw,
        step3: {
          narrative: result.narrative,
          findings: result.findings,
          triage_level: result.triage_level,
          confidence: result.confidence,
          fallbacks,
          used_provider: result.used.provider,
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_finding_synthesis",
            started_at: started,
            status: "ok",
            detail: { routing_fallbacks: fallbacks, provider: result.used.provider },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step3: {
          narrative: "Image interpretation unavailable.",
          findings: [],
          triage_level: "standard",
          confidence: 0,
          fallbacks: [error instanceof Error ? error.message : "interpret_failed"],
          used_provider: "none",
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_finding_synthesis",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
