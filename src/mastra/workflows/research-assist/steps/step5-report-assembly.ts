import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { researchAssistOutputSchema } from "@/contracts/research-assist-api";
import { finishDiagnostic, startTimer } from "@/mastra/workflows/health-triage/debug";
import { researchAssistWorkflowOutputSchema } from "@/mastra/workflows/research-assist/schemas";

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export const step5ResearchAssembly = createStep({
  id: "research-assist-step5-report-assembly",
  inputSchema: z.any(),
  outputSchema: researchAssistWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const started = startTimer();
    const raw = inputData as Record<string, unknown>;
    const s2 = raw.step2 as Record<string, unknown>;
    const s3 = raw.step3 as Record<string, unknown>;
    const s4 = raw.step4 as Record<string, unknown>;

    const mr = (s3.methodology_review && typeof s3.methodology_review === "object"
      ? s3.methodology_review
      : {}) as Record<string, unknown>;

    const methodology_review = {
      strengths: arr(mr.strengths).map(String),
      weaknesses: arr(mr.weaknesses).map(String),
      suggestions: arr(mr.suggestions).map(String),
    };

    const statistical_insights = arr(s2.statistical_insights).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        test: o.test !== undefined ? String(o.test) : undefined,
        result: String(o.result ?? ""),
        interpretation: o.interpretation !== undefined ? String(o.interpretation) : undefined,
        p_value: o.p_value !== undefined ? String(o.p_value) : undefined,
      };
    });

    const literature_connections = arr(s3.literature_connections).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        finding: String(o.finding ?? ""),
        related_work: o.related_work !== undefined ? String(o.related_work) : undefined,
        implication: o.implication !== undefined ? String(o.implication) : undefined,
      };
    });

    const data_quality_issues = arr(s2.data_quality_issues).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        column: o.column !== undefined ? String(o.column) : undefined,
        issue: String(o.issue ?? ""),
        recommendation: o.recommendation !== undefined ? String(o.recommendation) : undefined,
      };
    });

    const visualization_suggestions = arr(s3.visualization_suggestions).map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        chart_type: String(o.chart_type ?? "plot"),
        variables: o.variables !== undefined ? String(o.variables) : undefined,
        rationale: o.rationale !== undefined ? String(o.rationale) : undefined,
      };
    });

    const ds = s4.draft_sections && typeof s4.draft_sections === "object" ? s4.draft_sections : {};
    const drec = ds as Record<string, unknown>;
    const draft_sections =
      Object.keys(drec).length > 0
        ? {
            abstract: drec.abstract !== undefined ? String(drec.abstract) : undefined,
            methods: drec.methods !== undefined ? String(drec.methods) : undefined,
            results: drec.results !== undefined ? String(drec.results) : undefined,
            discussion: drec.discussion !== undefined ? String(drec.discussion) : undefined,
          }
        : undefined;

    const output = researchAssistOutputSchema.parse({
      analysis_summary: String(s2.analysis_summary ?? "Summary unavailable."),
      statistical_insights,
      methodology_review,
      literature_connections,
      next_steps: arr(s4.next_steps).map(String),
      data_quality_issues,
      visualization_suggestions,
      ...(draft_sections ? { draft_sections } : {}),
      ethical_considerations: arr(s4.ethical_considerations).map(String),
      disclaimer: String(
        s4.disclaimer ?? "Research acceleration output is assistive; validate methods and ethics locally."
      ),
    });

    return researchAssistWorkflowOutputSchema.parse({
      output,
      diagnostics: [
        ...(raw.diagnostics as unknown[] | undefined) ?? [],
        finishDiagnostic({ step: "step5_report_assembly", started_at: started, status: "ok" }),
      ],
    });
  },
});
