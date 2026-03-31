import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { researchStep2 } from "@/lib/research/gemini-research";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step2ResearchAnalysis = createStep({
  id: "research-assist-step2-data-analysis",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const s1 = raw.step1 as { user_block: string; locale?: string };
    try {
      const step2 = await researchStep2({
        requestId: jobId,
        locale: s1.locale,
        userBlock: s1.user_block,
      });
      return {
        ...raw,
        step2,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_data_analysis",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step2: {
          analysis_summary: "Analysis degraded.",
          statistical_insights: [],
          data_quality_issues: [],
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_data_analysis",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
