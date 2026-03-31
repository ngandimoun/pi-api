import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { researchStep3 } from "@/lib/research/gemini-research";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step3ResearchSynthesis = createStep({
  id: "research-assist-step3-synthesis",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const s1 = raw.step1 as { user_block: string; locale?: string };
    const s2 = raw.step2 as Record<string, unknown>;
    try {
      const step3 = await researchStep3({
        requestId: jobId,
        locale: s1.locale,
        userBlock: s1.user_block,
        step2: s2,
      });
      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_synthesis",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step3: {
          methodology_review: { strengths: [], weaknesses: [], suggestions: [] },
          literature_connections: [],
          visualization_suggestions: [],
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_synthesis",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
