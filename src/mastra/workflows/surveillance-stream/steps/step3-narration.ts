import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import type {
  Incident,
  PerceptionResult,
  StreamCreateInput,
} from "../../../../contracts/surveillance-api";
import { narrateIncidents } from "../../../../lib/surveillance/gemini-narrate";
import { finishDiagnostic, startTimer } from "../debug";

export const step3Narration = createStep({
  id: "surveillance-step3-narration",
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData }) => {
    const started = startTimer();
    const perception = inputData.perception as PerceptionResult;
    const incidents = (inputData.incidents ?? []) as Incident[];
    const streamInput = inputData.input as StreamCreateInput | undefined;
    const locale = streamInput?.output?.locale;

    if (!incidents.length) {
      return {
        ...inputData,
        incidents_narrated: [] as Incident[],
        diagnostics: [
          ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
          finishDiagnostic({
            step: "step3_narration",
            started_at: started,
            status: "ok",
            detail: { skipped: true },
          }),
        ],
      };
    }

    try {
      const narrated = await narrateIncidents({
        incidents,
        perception,
        context: (streamInput?.context as Record<string, unknown> | undefined) ?? undefined,
        locale,
      });
      return {
        ...inputData,
        incidents_narrated: narrated,
        diagnostics: [
          ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
          finishDiagnostic({
            step: "step3_narration",
            started_at: started,
            status: "ok",
            detail: { count: narrated.length },
          }),
        ],
      };
    } catch (e) {
      return {
        ...inputData,
        incidents_narrated: incidents,
        diagnostics: [
          ...(inputData as { diagnostics?: unknown[] }).diagnostics ?? [],
          finishDiagnostic({
            step: "step3_narration",
            started_at: started,
            status: "failed",
            detail: { error: e instanceof Error ? e.message : "narration_failed" },
          }),
        ],
      };
    }
  },
});
