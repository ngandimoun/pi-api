import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { adherenceOutputSchema } from "@/contracts/adherence-api";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { adherenceWorkflowOutputSchema } from "@/mastra/workflows/adherence/schemas";

function asStr(v: unknown, fb: string) {
  return typeof v === "string" && v.trim() ? v.trim() : fb;
}
function asNum01(v: unknown) {
  return typeof v === "number" && !Number.isNaN(v) ? Math.min(1, Math.max(0, v)) : 0.5;
}
function asArrStr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}
function asRisk(v: unknown): "high" | "moderate" | "low" {
  const s = String(v);
  if (s === "high" || s === "moderate" || s === "low") return s;
  return "moderate";
}

export const step5AdherenceAssembly = createStep({
  id: "adherence-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: adherenceWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const s2 = raw.step2 as Record<string, unknown>;
    const s3 = raw.step3 as Record<string, unknown>;
    const s4 = raw.step4 as Record<string, unknown>;

    const missed = Array.isArray(s2.missed_items) ? s2.missed_items : [];
    const normalizedMissed = missed.map((m: unknown) => {
      const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
      return {
        type: asStr(o.type, "unknown"),
        description: asStr(o.description, "Item"),
        date: typeof o.date === "string" ? o.date : undefined,
        severity: typeof o.severity === "string" ? o.severity : undefined,
      };
    });

    const output = adherenceOutputSchema.parse({
      adherence_risk: asRisk(s3.adherence_risk),
      next_action: asStr(s4.next_action, "Review adherence with care team."),
      missed_items: normalizedMissed,
      predicted_dropoff_window: asStr(
        s3.predicted_dropoff_window,
        "Reassess within 2 weeks."
      ),
      intervention_recommendations:
        asArrStr(s4.intervention_recommendations).length > 0
          ? asArrStr(s4.intervention_recommendations)
          : [asStr(s4.next_action, "Follow up")],
      engagement_score: asNum01(s2.engagement_score),
      barriers_detected: asArrStr(s2.barriers_detected),
      escalation_triggers: asArrStr(s3.escalation_triggers),
      risk_flags: asArrStr(s3.risk_flags),
      disclaimer: asStr(
        s4.disclaimer,
        "Adherence insights support care management only; not a diagnosis."
      ),
    });

    return adherenceWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
