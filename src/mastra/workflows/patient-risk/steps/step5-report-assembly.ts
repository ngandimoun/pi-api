import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { patientRiskOutputSchema } from "@/contracts/patient-risk-api";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { patientRiskWorkflowOutputSchema } from "@/mastra/workflows/patient-risk/schemas";

const DEFAULT_DISCLAIMER =
  "This output supports triage prioritization only. It is not a diagnosis or substitute for licensed medical judgment.";

function asStr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((s) => s.length > 0);
}

function asRiskLevel(v: unknown): "critical" | "high" | "moderate" | "low" {
  const s = typeof v === "string" ? v : "";
  if (s === "critical" || s === "high" || s === "moderate" || s === "low") return s;
  return "moderate";
}

function asTime(v: unknown): "immediate" | "hours" | "days" | "weeks" {
  const s = typeof v === "string" ? v : "";
  if (s === "immediate" || s === "hours" || s === "days" || s === "weeks") return s;
  return "days";
}

export const step5PatientRiskAssembly = createStep({
  id: "patient-risk-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: patientRiskWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const step2 = raw.step2 as Record<string, unknown>;
    const step3 = raw.step3 as Record<string, unknown>;
    const step4 = raw.step4 as Record<string, unknown>;

    const risk_level = asRiskLevel(step2.risk_level);
    const time_sensitivity = asTime(step2.time_sensitivity);
    const priority_rank_rationale = asStr(
      step3.priority_rank_rationale,
      asStr(step2.clinical_rationale, "See clinical rationale from risk step.")
    );
    const next_action = asStr(step4.next_action, "Schedule clinician review.");
    const recommended_actions = asStrArray(step4.recommended_actions);
    const escalation_triggers = asStrArray(step2.escalation_triggers);
    const differential_considerations = asStrArray(step3.differential_considerations);
    const resource_requirements = asStrArray(step3.resource_requirements);
    const risk_flags = asStrArray(step2.risk_flags);

    const clinical =
      typeof step4.clinical_style_summary === "string" && step4.clinical_style_summary.trim().length > 0
        ? step4.clinical_style_summary.trim().slice(0, 16_000)
        : undefined;

    const output = patientRiskOutputSchema.parse({
      risk_level,
      priority_rank_rationale,
      next_action,
      recommended_actions: recommended_actions.length > 0 ? recommended_actions : [next_action],
      time_sensitivity,
      escalation_triggers,
      differential_considerations,
      resource_requirements,
      risk_flags,
      disclaimer: asStr(step4.disclaimer, DEFAULT_DISCLAIMER),
      ...(clinical ? { clinical_style_summary: clinical } : {}),
      metadata: {
        step2_clinical_rationale: typeof step2.clinical_rationale === "string" ? step2.clinical_rationale : undefined,
      },
    });

    return patientRiskWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
