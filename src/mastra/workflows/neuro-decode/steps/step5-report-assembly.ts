import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { neuroDecodeWorkflowOutputSchema } from "@/mastra/workflows/neuro-decode/schemas";

const DEFAULT_DISCLAIMER =
  "BCI outputs are probabilistic and not a medical diagnosis. Always provide human oversight and local safety interlocks for mobility or environmental control.";

export const step5NeuroReportAssembly = createStep({
  id: "neuro-decode-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: neuroDecodeWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const step2 = raw.step2 as {
      seizure_detected: boolean;
    };
    const step3 = raw.step3 as {
      decoded_intent: string;
      confidence: number;
      paradigm_detected: string;
      alternatives: Array<{ intent: string; confidence: number }>;
      red_flags: string[];
    };
    const step4 = raw.step4 as {
      predicted_text: string;
      session_context?: string;
    };

    const output = {
      decoded_intent: step3.decoded_intent,
      confidence: step3.confidence,
      paradigm_detected: step3.paradigm_detected,
      predicted_text: step4.predicted_text,
      alternatives: step3.alternatives ?? [],
      session_context: step4.session_context,
      seizure_detected: step2.seizure_detected,
      red_flags: step3.red_flags ?? [],
      disclaimer: DEFAULT_DISCLAIMER,
    };

    return neuroDecodeWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
