import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { notesExtractStep2 } from "@/lib/clinical/gemini-notes-structure";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step2NotesEntities = createStep({
  id: "notes-structure-step2-entity-extraction",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const s1 = raw.step1 as { locale?: string; notes: string; format_hint?: string };
    try {
      const step2 = await notesExtractStep2({
        requestId: jobId,
        locale: input.output?.locale ?? s1.locale,
        notes: s1.notes,
        formatHint: s1.format_hint,
        context: input.context,
      });
      return {
        ...raw,
        step2,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_entity_extraction",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step2: {
          symptoms: [],
          conditions: [],
          medications: [],
          risk_factors: [],
          procedures: [],
          allergies: [],
          vitals_extracted: {},
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step2_entity_extraction",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
