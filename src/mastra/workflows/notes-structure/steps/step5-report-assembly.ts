import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { notesStructureOutputSchema } from "@/contracts/notes-structure-api";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { notesStructureWorkflowOutputSchema } from "@/mastra/workflows/notes-structure/schemas";

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export const step5NotesAssembly = createStep({
  id: "notes-structure-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: notesStructureWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const s2 = raw.step2 as Record<string, unknown>;
    const s3 = raw.step3 as Record<string, unknown>;
    const s4 = raw.step4 as Record<string, unknown>;

    const symptoms = arr<Record<string, unknown>>(s2.symptoms).map((o) => ({
      name: String(o.name ?? "unknown"),
      severity: o.severity !== undefined ? String(o.severity) : undefined,
      onset: o.onset !== undefined ? String(o.onset) : undefined,
      duration: o.duration !== undefined ? String(o.duration) : undefined,
      status: o.status !== undefined ? String(o.status) : undefined,
    }));

    const conditions = arr<Record<string, unknown>>(s2.conditions).map((o) => ({
      name: String(o.name ?? "unknown"),
      icd_hint: o.icd_hint !== undefined ? String(o.icd_hint) : undefined,
      status: o.status !== undefined ? String(o.status) : undefined,
      confidence: typeof o.confidence === "number" ? o.confidence : undefined,
    }));

    const medications = arr<Record<string, unknown>>(s2.medications).map((o) => ({
      name: String(o.name ?? "unknown"),
      dose: o.dose !== undefined ? String(o.dose) : undefined,
      frequency: o.frequency !== undefined ? String(o.frequency) : undefined,
      route: o.route !== undefined ? String(o.route) : undefined,
      status: o.status !== undefined ? String(o.status) : undefined,
      start_date: o.start_date !== undefined ? String(o.start_date) : undefined,
    }));

    const risk_factors = arr<Record<string, unknown>>(s2.risk_factors).map((o) => ({
      factor: String(o.factor ?? o.name ?? "risk"),
      severity: o.severity !== undefined ? String(o.severity) : undefined,
      modifiable: typeof o.modifiable === "boolean" ? o.modifiable : undefined,
    }));

    const procedures = arr<Record<string, unknown>>(s2.procedures).map((o) => ({
      name: String(o.name ?? "procedure"),
      date: o.date !== undefined ? String(o.date) : undefined,
      outcome: o.outcome !== undefined ? String(o.outcome) : undefined,
    }));

    const allergies = arr<Record<string, unknown>>(s2.allergies).map((o) => ({
      substance: String(o.substance ?? o.name ?? "unknown"),
      reaction: o.reaction !== undefined ? String(o.reaction) : undefined,
      severity: o.severity !== undefined ? String(o.severity) : undefined,
    }));

    const vitals =
      s2.vitals_extracted && typeof s2.vitals_extracted === "object" && !Array.isArray(s2.vitals_extracted)
        ? (s2.vitals_extracted as Record<string, unknown>)
        : undefined;

    const timeline = arr<Record<string, unknown>>(s3.timeline).map((o) => ({
      date: o.date !== undefined ? String(o.date) : undefined,
      event: String(o.event ?? "event"),
      category: o.category !== undefined ? String(o.category) : undefined,
    }));

    const coding_suggestions = arr<Record<string, unknown>>(s3.coding_suggestions)
      .map((o) => ({
        code: String(o.code ?? "").trim(),
        system: o.system !== undefined ? String(o.system) : undefined,
        description: o.description !== undefined ? String(o.description) : undefined,
        confidence: typeof o.confidence === "number" ? o.confidence : undefined,
      }))
      .filter((c) => c.code.length > 0);

    const output = notesStructureOutputSchema.parse({
      summary: String(s4.summary ?? "Summary unavailable."),
      disclaimer: String(
        s4.disclaimer ?? "Structured extraction is assistive only; verify in source record."
      ),
      symptoms,
      conditions,
      medications,
      risk_factors,
      procedures,
      allergies,
      ...(vitals ? { vitals_extracted: vitals } : {}),
      timeline,
      action_items: Array.isArray(s4.action_items) ? s4.action_items.map(String) : [],
      coding_suggestions,
    });

    return notesStructureWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
