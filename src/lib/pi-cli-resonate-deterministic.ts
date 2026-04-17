import type { GatheredRoutineContext } from "@/lib/pi-cli-routine-context";

/**
 * Deterministic, numbered facts derived from gathered Pi context (no LLM).
 * Injected into resonate prompts as MUST-RECONCILE FACTS.
 */
export function buildDeterministicFacts(params: {
  gathered: GatheredRoutineContext;
  gitDiffSummary?: string;
}): string {
  const { gathered, gitDiffSummary } = params;
  const lines: string[] = [];
  let n = 1;

  const graphOk = !gathered.graph_summary.trim().startsWith("(no import graph");
  const styleOk = !gathered.system_style_summary.trim().startsWith("(no system_style");
  const histOk = !gathered.import_histogram_note.includes("(no import histogram");

  if (histOk) {
    lines.push(`FACT ${n++}: Import / dependency signals — ${gathered.import_histogram_note.slice(0, 600)}`);
  }

  if (gathered.framework_hints_note.trim()) {
    lines.push(`FACT ${n++}: ${gathered.framework_hints_note.slice(0, 400)}`);
  }

  if (graphOk) {
    const g = gathered.graph_summary.trim();
    lines.push(`FACT ${n++}: Import graph (excerpt) — ${g.slice(0, 1200)}${g.length > 1200 ? "…" : ""}`);
  } else {
    lines.push(`FACT ${n++}: No Pi import graph in cloud storage — file-level impact from graph cannot be verified until \`pi learn --with-graph\` populates it.`);
  }

  if (styleOk) {
    const s = gathered.system_style_summary.trim();
    lines.push(`FACT ${n++}: system-style summary (excerpt) — ${s.slice(0, 900)}${s.length > 900 ? "…" : ""}`);
  } else {
    lines.push(`FACT ${n++}: No local system-style.json summary — conventions may be unknown until \`pi learn\` runs.`);
  }

  if (gathered.ast_summaries && !gathered.ast_summaries.startsWith("(no file excerpts")) {
    lines.push(`FACT ${n++}: AST / excerpt hints (excerpt) — ${gathered.ast_summaries.slice(0, 800)}…`);
  }

  if (gitDiffSummary?.trim()) {
    lines.push(
      `FACT ${n++}: Current working tree / staged changes (highest priority for this session) —\n${gitDiffSummary.trim().slice(0, 8000)}`
    );
  }

  if (!lines.length) {
    return "(no deterministic facts could be derived — grounding is thin.)";
  }

  return lines.join("\n\n");
}
