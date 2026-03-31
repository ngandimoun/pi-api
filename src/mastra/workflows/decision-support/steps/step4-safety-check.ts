import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { decisionSafetyStep4 } from "@/lib/clinical/gemini-decision-support";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step4DecisionSafety = createStep({
  id: "decision-support-step4-safety-check",
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
      const { parsed, routing_fallbacks } = await decisionSafetyStep4({
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
            step: "step4_safety_check",
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
          contraindications: [],
          monitoring_plan: [],
          escalation_criteria: ["If patient worsens, seek emergency care."],
          patient_communication: "Please discuss these results with your care team.",
          risk_flags: ["safety_layer_degraded"],
          disclaimer: "Clinical decision support failed partially; verify all recommendations.",
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_safety_check",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
