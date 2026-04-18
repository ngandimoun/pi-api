import { z } from "zod";

import { buildCliThreadId } from "@/lib/pi-cli-thread";
import type { DependencyGraph } from "@/lib/pi-cli-graph";
import { findRelevantRoutines } from "@/lib/pi-cli-routine-composer";

export const routineContextPayloadSchema = z
  .object({
    file_sample_paths: z.array(z.string()).max(200).optional(),
    file_excerpts: z
      .array(
        z.object({
          path: z.string(),
          excerpt: z.string().max(20_000),
        })
      )
      .max(40)
      .optional(),
    import_histogram: z.record(z.number()).optional(),
    framework_hints: z.array(z.string()).max(80).optional(),
    polyglot_hints: z.array(z.string()).max(20).optional(),
    mastra_artifact_sample_paths: z.array(z.string()).max(40).optional(),
    existing_routine_slugs: z.array(z.string()).max(200).optional(),
    existing_routines_metadata: z
      .array(
        z.object({
          id: z.string(),
          tags: z.array(z.string()),
          intent: z.string(),
        })
      )
      .max(200)
      .optional(),
  })
  .strict();

export type RoutineContextPayload = z.infer<typeof routineContextPayloadSchema>;

export type GatheredRoutineContext = {
  memory_context: string;
  graph_summary: string;
  ast_summaries: string;
  system_style_summary: string;
  existing_routines_note: string;
  import_histogram_note: string;
  framework_hints_note: string;
  relevant_routines: Array<{
    routine_id: string;
    routine_file: string;
    relevance_score: number;
    reason: string;
  }>;
};

function tokenizeIntent(intent: string): string[] {
  return intent
    .toLowerCase()
    .split(/[^a-z0-9+/]+/g)
    .filter((w) => w.length > 2);
}

function scorePath(path: string, keywords: string[]): number {
  const p = path.toLowerCase().replace(/\\/g, "/");
  let s = 0;
  for (const k of keywords) {
    if (p.includes(k)) s += 2;
  }
  return s;
}

function summarizeGraphForIntent(graph: DependencyGraph | null, intent: string, samplePaths: string[]): string {
  if (!graph?.nodes?.length) {
    return "(no import graph in Pi storage — run `pi learn --with-graph` to populate.)";
  }
  const keywords = tokenizeIntent(intent);
  const nodeIds = graph.nodes.map((n) => n.id);
  const ranked = [...new Set([...nodeIds, ...samplePaths])]
    .map((id) => ({ id, score: scorePath(id, keywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  const lines: string[] = [];
  const edgeFrom = new Map<string, Set<string>>();
  const edgeTo = new Map<string, Set<string>>();
  for (const e of graph.edges ?? []) {
    if (!edgeFrom.has(e.from)) edgeFrom.set(e.from, new Set());
    if (!edgeTo.has(e.to)) edgeTo.set(e.to, new Set());
    edgeFrom.get(e.from)!.add(e.to);
    edgeTo.get(e.to)!.add(e.from);
  }

  for (const { id } of ranked) {
    const deps = [...(edgeFrom.get(id) ?? [])].slice(0, 8);
    const inc = [...(edgeTo.get(id) ?? [])].slice(0, 8);
    if (deps.length || inc.length || scorePath(id, keywords) > 0) {
      lines.push(`- **${id}**`);
      if (deps.length) lines.push(`  - imports → ${deps.join(", ")}`);
      if (inc.length) lines.push(`  - imported by ← ${inc.join(", ")}`);
    }
  }

  if (!lines.length) {
    return `Graph has ${graph.nodes.length} nodes — no strong keyword match; sample: ${nodeIds.slice(0, 12).join(", ")}`;
  }
  return lines.join("\n");
}

function summarizeSystemStyle(systemStyle: Record<string, unknown> | undefined, intent: string): string {
  if (!systemStyle || !Object.keys(systemStyle).length) {
    return "(no system_style — run `pi learn`.)";
  }
  const q = intent.toLowerCase();
  const keys = Object.keys(systemStyle).slice(0, 80);
  const keys_touched = keys.filter(
    (k) =>
      k.toLowerCase().includes(q) ||
      q.split(/\s+/).some((w) => w.length > 2 && k.toLowerCase().includes(w))
  );
  const pick = keys_touched.length ? keys_touched : keys.slice(0, 12);
  const lines = pick.map((k) => {
    const v = systemStyle[k];
    const snippet =
      typeof v === "string" ? v.slice(0, 220) : JSON.stringify(v, null, 0).slice(0, 220);
    return `- ${k}: ${snippet}`;
  });
  return lines.join("\n").slice(0, 4000) || "(empty system_style)";
}

async function recallMemory(
  organizationId: string,
  threadId: string | undefined,
  intent: string
): Promise<string> {
  const { createPiCliMemory } = await import("@/lib/pi-cli-memory");
  const mem = createPiCliMemory();
  if (!mem || !threadId?.trim()) return "";
  const learnThreadId = buildCliThreadId({
    organizationId,
    branchName: "main",
    developerId: "system",
  });
  const vectorSearchString = intent.slice(0, 2000);
  const threadConfig = {
    semanticRecall: Boolean(
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
        process.env.GEMINI_KEY?.trim() ||
        process.env.GEMINI_API_KEY?.trim()
    ),
  };
  try {
    const chunks: string[] = [];
    const { messages } = await mem.recall({
      threadId,
      perPage: 20,
      vectorSearchString,
      threadConfig,
    });
    chunks.push(...messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))));
    if (learnThreadId !== threadId) {
      const learnRecall = await mem.recall({
        threadId: learnThreadId,
        perPage: 15,
        vectorSearchString: intent,
        threadConfig,
      });
      chunks.push(
        ...learnRecall.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
      );
    }
    return chunks.join("\n").slice(0, 8000);
  } catch (e) {
    return `(memory recall skipped: ${String(e)})`;
  }
}

async function summarizeAstFromExcerpts(
  excerpts: { path: string; excerpt: string }[]
): Promise<string> {
  const lines: string[] = [];
  for (const { path, excerpt } of excerpts.slice(0, 15)) {
    try {
      const base = path.split("/").pop() || path;
      const { extractAstFactsFromExcerpt } = await import("@/mastra/tools/extract-ast-tool");
      const facts = await extractAstFactsFromExcerpt(base, excerpt.slice(0, 50_000));
      lines.push(`### ${path}`);
      lines.push(`- hooks: ${facts.reactHookNames.slice(0, 12).join(", ") || "(none)"}`);
      lines.push(`- imports: ${facts.importSpecifiers.slice(0, 20).join(", ") || "(none)"}`);
      lines.push(`- jsx .map: ${facts.hasMapCallInJsx}`);
    } catch (e) {
      lines.push(`### ${path}`, `(ast parse skipped: ${String(e)})`);
    }
  }
  return lines.join("\n").slice(0, 12_000);
}

/**
 * Server-side context for routine generation: graph, memory, optional client-provided repo hints.
 */
export async function gatherRoutineContext(input: {
  organization_id: string;
  thread_id?: string;
  intent: string;
  system_style?: Record<string, unknown>;
  routine_context?: RoutineContextPayload;
}): Promise<GatheredRoutineContext> {
  const rc = input.routine_context ?? {};
  const { downloadLatestPiGraph } = await import("@/lib/pi-cli-r2");
  const graph = await downloadLatestPiGraph(input.organization_id);
  const sample = rc.file_sample_paths ?? [];
  const graph_summary = summarizeGraphForIntent(graph, input.intent, sample);

  const memory_context = await recallMemory(input.organization_id, input.thread_id, input.intent);
  const system_style_summary = summarizeSystemStyle(input.system_style, input.intent);

  const ast_summaries = rc.file_excerpts?.length
    ? await summarizeAstFromExcerpts(rc.file_excerpts)
    : "(no file excerpts — pass `routine_context.file_excerpts` from CLI with `--with-excerpts` for deeper AST hints.)";

  const meta = rc.existing_routines_metadata ?? [];
  const slugList = rc.existing_routine_slugs?.length
    ? rc.existing_routine_slugs
    : meta.length
      ? [...new Set(meta.map((m) => m.id))]
      : [];

  const existing =
    meta.length > 0
      ? `Existing routines (with metadata):\n${meta
          .slice(0, 80)
          .map((r) => `- ${r.id}: "${r.intent}" [${r.tags.join(", ")}]`)
          .join("\n")}`
      : rc.existing_routine_slugs?.length
        ? `Existing routine files in .pi/routines (reference / avoid duplicating): ${rc.existing_routine_slugs.slice(0, 80).join(", ")}`
        : "(no existing routine list provided.)";

  const relevant_routines = await findRelevantRoutines(
    input.organization_id,
    input.thread_id,
    input.intent,
    slugList,
    meta
  );

  const ih = rc.import_histogram;
  const import_histogram_note = ih && Object.keys(ih).length
    ? `Top import keys (from local scan): ${Object.entries(ih)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ")}`
    : "(no import histogram — CLI can send `routine_context.import_histogram`.)";

  const hintLines: string[] = [];
  if (rc.framework_hints?.length) {
    hintLines.push(`Framework hints: ${rc.framework_hints.join(", ")}`);
  }
  if (rc.polyglot_hints?.length) {
    hintLines.push(`Polyglot: ${rc.polyglot_hints.join(", ")}`);
  }
  if (rc.mastra_artifact_sample_paths?.length) {
    hintLines.push(
      `Mastra artifacts (sample paths): ${rc.mastra_artifact_sample_paths.slice(0, 25).join(", ")}`
    );
  }
  const framework_hints_note = hintLines.join("\n");

  return {
    memory_context,
    graph_summary,
    ast_summaries,
    system_style_summary,
    existing_routines_note: existing,
    import_histogram_note,
    framework_hints_note,
    relevant_routines,
  };
}
