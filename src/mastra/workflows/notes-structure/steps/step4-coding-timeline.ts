import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { notesFinalizeStep4 } from "@/lib/clinical/gemini-notes-structure";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";

export const step4NotesFinalize = createStep({
  id: "notes-structure-step4-coding-timeline",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const jobId = String(raw.job_id ?? "");
    const input = raw.input as { context?: Record<string, unknown>; output?: { locale?: string } };
    const s1 = raw.step1 as { locale?: string; notes: string };
    const s2 = raw.step2 as Record<string, unknown>;
    const s3 = raw.step3 as Record<string, unknown>;
    try {
      const { parsed, routing_fallbacks } = await notesFinalizeStep4({
        requestId: jobId,
        locale: input.output?.locale ?? s1.locale,
        notes: s1.notes,
        step2: s2,
        step3: s3,
        context: input.context,
      });
      return {
        ...raw,
        step4: parsed,
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_coding_finalize",
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
          summary: "Structured extraction completed with degraded narrative summary.",
          disclaimer: "Not for clinical decision-making without human verification.",
          action_items: ["Verify extracted entities against source chart"],
        },
        diagnostics: [
          ...(raw.diagnostics as unknown[] | undefined) ?? [],
          finishDiagnostic({
            step: "step4_coding_finalize",
            started_at: started,
            status: "failed",
            detail: { error: error instanceof Error ? error.message : "unknown" },
          }),
        ],
      } as Record<string, unknown>;
    }
  },
});
