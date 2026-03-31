import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { decisionCoreStep3 } from "@/lib/clinical/gemini-decision-support";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step3DecisionCore = createStep({
  id: "decision-support-step3-decision-generation",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const s1 = raw.step1 as { user_block: string };
    const s2 = raw.step2 as Record<string, unknown>;
    try {
      const step3 = await decisionCoreStep3({
        requestId: jobId,
        userBlock: s1.user_block,
        step2: s2,
      });
      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_decision_generation",
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
          recommended_action: "Escalate to senior clinician for case review.",
          reasoning: "Automated decision support degraded.",
          confidence: 0.3,
          alternatives: [],
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_decision_generation",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
