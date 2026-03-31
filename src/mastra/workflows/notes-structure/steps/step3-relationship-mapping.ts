import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { notesTimelineStep3 } from "@/lib/clinical/gemini-notes-structure";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step3NotesTimeline = createStep({
  id: "notes-structure-step3-relationship-mapping",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const s1 = raw.step1 as { locale?: string; notes: string };
    const s2 = raw.step2 as Record<string, unknown>;
    try {
      const step3 = await notesTimelineStep3({
        requestId: jobId,
        locale: input.output?.locale ?? s1.locale,
        notes: s1.notes,
        step2: s2,
        context: input.context,
      });
      return {
        ...raw,
        step3,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_relationship_mapping",
            started_at: started,
            status: "ok",
            detail: { provider: "gemini" },
          }),
        ],
      } as Record<string, unknown>;
    } catch (error) {
      return {
        ...raw,
        step3: { timeline: [], coding_suggestions: [] },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step3_relationship_mapping",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
