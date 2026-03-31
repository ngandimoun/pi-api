import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { scanStructuredReportStep4 } from "@/lib/imaging/gemini-scan-analysis";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step4ScanExplanation = createStep({
  id: "scan-analysis-step4-explanation-generation",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const s1 = raw.step1 as {
      modality: string;
      locale?: string;
      clinical_question?: string;
    };
    const s2 = raw.step2 as { processed_summary?: string | null; segmentation_overlay_url?: string | null };
    const s3 = raw.step3 as {
      narrative: string;
      findings: unknown[];
      triage_level: string;
      fallbacks: string[];
    };

    try {
      const { parsed, routing_fallbacks } = await scanStructuredReportStep4({
        requestId: jobId,
        locale: input.output?.locale ?? s1.locale,
        modality: s1.modality,
        clinicalQuestion: s1.clinical_question,
        priorInterpretation: {
          narrative: s3.narrative,
          findings_json: JSON.stringify(s3.findings ?? []).slice(0, 40_000),
          triage_level: s3.triage_level,
          fallbacks: s3.fallbacks ?? [],
        },
        monaiSummary: s2.processed_summary ?? null,
        overlayUrl: s2.segmentation_overlay_url ?? null,
        context: input.context,
      });

      return {
        ...raw,
        step4: parsed,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_explanation_generation",
            started_at: started,
            status: "ok",
            detail: { routing_fallbacks },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step4: {
          findings: [],
          impression: s3.narrative || "See raw interpretation narrative.",
          plain_language_explanation: "Please discuss imaging results with a qualified clinician.",
          anomalies_detected: s3.triage_level === "critical" || s3.triage_level === "urgent",
          recommended_followup: "Clinical correlation and specialist review if indicated.",
          urgency: s3.triage_level === "critical" ? "stat" : "routine",
          differential: [],
          measurements: [],
          risk_flags: ["structured_report_degraded"],
          disclaimer: "Imaging explanation failed partially; not a radiology report.",
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_explanation_generation",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
