import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { scanAnalysisOutputSchema } from "@/contracts/scan-analysis-api";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { scanAnalysisWorkflowOutputSchema } from "@/mastra/workflows/scan-analysis/schemas";

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function urg(v: unknown): "stat" | "routine" | "non_urgent" {
  const s = String(v);
  if (s === "stat" || s === "routine" || s === "non_urgent") return s;
  return "routine";
}

export const step5ScanAssembly = createStep({
  id: "scan-analysis-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: scanAnalysisWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const s2 = raw.step2 as { segmentation_overlay_url?: string | null };
    const s4 = raw.step4 as Record<string, unknown>;

    const findings = arr(s4.findings)
      .map((x) => {
        const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        const description = String(o.description ?? "").trim() || "Unspecified finding";
        return {
          region: o.region !== undefined ? String(o.region) : undefined,
          description,
          severity: o.severity !== undefined ? String(o.severity) : undefined,
          confidence: typeof o.confidence === "number" ? o.confidence : undefined,
        };
      })
      .filter((f) => f.description.length > 0);

    const differential = arr(s4.differential).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        condition: String(o.condition ?? "unknown"),
        likelihood: o.likelihood !== undefined ? String(o.likelihood) : undefined,
      };
    });

    const measurements = arr(s4.measurements).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        structure: String(o.structure ?? ""),
        value: String(o.value ?? ""),
        unit: o.unit !== undefined ? String(o.unit) : undefined,
        normal_range: o.normal_range !== undefined ? String(o.normal_range) : undefined,
      };
    });

    const overlay = s2.segmentation_overlay_url;
    const output = scanAnalysisOutputSchema.parse({
      findings,
      impression: String(s4.impression ?? "Impression pending."),
      plain_language_explanation: String(
        s4.plain_language_explanation ?? "Discuss with your doctor."
      ),
      anomalies_detected: Boolean(s4.anomalies_detected),
      recommended_followup: String(s4.recommended_followup ?? "Follow clinician guidance."),
      urgency: urg(s4.urgency),
      differential,
      measurements,
      segmentation_overlay_url: typeof overlay === "string" && overlay.length > 0 ? overlay : null,
      risk_flags: arr(s4.risk_flags).map(String),
      disclaimer: String(
        s4.disclaimer ?? "Not a definitive imaging diagnosis; specialist interpretation required."
      ),
    });

    return scanAnalysisWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
