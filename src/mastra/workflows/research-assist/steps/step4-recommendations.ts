import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { researchStep4 } from "@/lib/research/gemini-research";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step4ResearchFinalize = createStep({
  id: "research-assist-step4-recommendations",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const s1 = raw.step1 as { user_block: string; locale?: string };
    const s2 = raw.step2 as Record<string, unknown>;
    const s3 = raw.step3 as Record<string, unknown>;
    try {
      const { parsed, routing_fallbacks } = await researchStep4({
        requestId: jobId,
        locale: s1.locale,
        userBlock: s1.user_block,
        step2: s2,
        step3: s3,
      });
      return {
        ...raw,
        step4: parsed,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_recommendations",
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
          next_steps: ["Consult domain statistician"],
          draft_sections: {},
          ethical_considerations: ["Ensure IRB and data use agreements"],
          disclaimer: "Research assistant output degraded.",
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_recommendations",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
