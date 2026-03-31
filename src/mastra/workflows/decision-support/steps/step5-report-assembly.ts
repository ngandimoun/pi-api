import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { decisionSupportOutputSchema } from "@/contracts/decision-support-api";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { decisionSupportWorkflowOutputSchema } from "@/mastra/workflows/decision-support/schemas";

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export const step5DecisionAssembly = createStep({
  id: "decision-support-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: decisionSupportWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const s2 = raw.step2 as Record<string, unknown>;
    const s3 = raw.step3 as Record<string, unknown>;
    const s4 = raw.step4 as Record<string, unknown>;

    const evidence_references = arr(s2.evidence_references).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        guideline: o.guideline !== undefined ? String(o.guideline) : undefined,
        recommendation: String(o.recommendation ?? o.text ?? "reference"),
        strength: o.strength !== undefined ? String(o.strength) : undefined,
      };
    });

    const alternatives = arr(s3.alternatives).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        action: String(o.action ?? "alternative"),
        rationale: String(o.rationale ?? ""),
        when_to_prefer: o.when_to_prefer !== undefined ? String(o.when_to_prefer) : undefined,
      };
    });

    const conf =
      typeof s3.confidence === "number" && !Number.isNaN(s3.confidence)
        ? Math.min(1, Math.max(0, s3.confidence))
        : 0.5;

    const output = decisionSupportOutputSchema.parse({
      recommended_action: String(s3.recommended_action ?? "Clinical review"),
      reasoning: String(s3.reasoning ?? ""),
      confidence: conf,
      alternatives,
      contraindications: arr(s4.contraindications).map(String),
      evidence_references,
      monitoring_plan: arr(s4.monitoring_plan).map(String),
      escalation_criteria: arr(s4.escalation_criteria).map(String),
      patient_communication: String(s4.patient_communication ?? "Discuss with your clinician."),
      risk_flags: arr(s4.risk_flags).map(String),
      disclaimer: String(
        s4.disclaimer ?? "Decision support only; not a substitute for licensed medical judgment."
      ),
    });

    return decisionSupportWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
