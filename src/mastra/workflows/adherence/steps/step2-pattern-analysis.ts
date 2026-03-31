import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { adherenceStep2 } from "@/lib/clinical/gemini-adherence";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step2AdherencePatterns = createStep({
  id: "adherence-step2-pattern-analysis",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const step1 = raw.step1 as { locale?: string; payload_json: string };
    try {
      const step2 = await adherenceStep2({
        requestId: jobId,
        locale: input.output?.locale ?? step1.locale,
        payloadJson: step1.payload_json,
        context: input.context,
      });
      return {
        ...raw,
        step2,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_pattern_analysis",
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
          missed_items: [],
          engagement_score: 0.5,
          barriers_detected: [],
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_pattern_analysis",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
