import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { decisionEvidenceStep2 } from "@/lib/clinical/gemini-decision-support";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step2DecisionEvidence = createStep({
  id: "decision-support-step2-evidence-synthesis",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const s1 = raw.step1 as { user_block: string };
    try {
      const step2 = await decisionEvidenceStep2({ requestId: jobId, userBlock: s1.user_block });
      return {
        ...raw,
        step2,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_evidence_synthesis",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step2: { evidence_references: [], key_facts: [] },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_evidence_synthesis",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
