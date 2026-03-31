import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { medicationCheckOutputSchema } from "@/contracts/medication-check-api";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { medicationCheckWorkflowOutputSchema } from "@/mastra/workflows/medication-check/schemas";

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function risk(v: unknown): "high" | "moderate" | "low" {
  const s = String(v);
  if (s === "high" || s === "moderate" || s === "low") return s;
  return "moderate";
}

export const step5MedicationAssembly = createStep({
  id: "medication-check-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: medicationCheckWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const s2 = raw.step2 as Record<string, unknown>;
    const s3 = raw.step3 as Record<string, unknown>;
    const s4 = raw.step4 as Record<string, unknown>;

    const interactions = arr(s2.interactions).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        drug_a: String(o.drug_a ?? o.a ?? "unknown"),
        drug_b: String(o.drug_b ?? o.b ?? "unknown"),
        severity: o.severity !== undefined ? String(o.severity) : undefined,
        mechanism: o.mechanism !== undefined ? String(o.mechanism) : undefined,
        recommendation: o.recommendation !== undefined ? String(o.recommendation) : undefined,
      };
    });

    const contraindications = arr(s2.contraindications).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        medication: String(o.medication ?? "unknown"),
        condition: String(o.condition ?? "unknown"),
        severity: o.severity !== undefined ? String(o.severity) : undefined,
        recommendation: o.recommendation !== undefined ? String(o.recommendation) : undefined,
      };
    });

    const dosing_alerts = arr(s2.dosing_alerts).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        medication: String(o.medication ?? "unknown"),
        issue: String(o.issue ?? "issue"),
        recommendation: o.recommendation !== undefined ? String(o.recommendation) : undefined,
      };
    });

    const adherence_barriers = arr(s3.adherence_barriers).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        medication: String(o.medication ?? "unknown"),
        barrier: String(o.barrier ?? ""),
        suggestion: o.suggestion !== undefined ? String(o.suggestion) : undefined,
      };
    });

    const optimization_suggestions = arr(s3.optimization_suggestions).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        current: String(o.current ?? ""),
        suggested: String(o.suggested ?? ""),
        rationale: o.rationale !== undefined ? String(o.rationale) : undefined,
      };
    });

    const missing_medications = arr(s3.missing_medications).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        condition: String(o.condition ?? ""),
        recommended_class: String(o.recommended_class ?? ""),
        rationale: o.rationale !== undefined ? String(o.rationale) : undefined,
      };
    });

    const monitoring_plan = arr(s3.monitoring_plan).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        medication: String(o.medication ?? ""),
        test: String(o.test ?? ""),
        frequency: o.frequency !== undefined ? String(o.frequency) : undefined,
      };
    });

    const output = medicationCheckOutputSchema.parse({
      interactions,
      contraindications,
      adherence_risk: risk(s3.adherence_risk),
      adherence_barriers,
      optimization_suggestions,
      missing_medications,
      dosing_alerts,
      next_action: String(s4.next_action ?? "Medication review with clinician."),
      monitoring_plan,
      patient_education: arr(s4.patient_education).map(String),
      risk_flags: arr(s4.risk_flags).map(String),
      disclaimer: String(
        s4.disclaimer ?? "Not a substitute for pharmacist or prescriber review."
      ),
    });

    return medicationCheckWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
