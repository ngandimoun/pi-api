import fs from "node:fs/promises";
import path from "node:path";
import { confirm, isCancel } from "@clack/prompts";
import chalk from "chalk";
import clipboard from "clipboardy";
import { safeParseRoutineSpecification } from "pi-routine-spec";
import { PiApiClient } from "../lib/api-client.js";
import { injectPiContextToAllIDEs } from "../lib/agentic-ide-injector.js";
import { ensurePiDir, ensureSystemStyleJson, ensureTeamSyncIfNeeded, type PreFlightGlobalOpts } from "../lib/dependency-chain.js";
import { printPickUpWhereYouLeftOff } from "../lib/recovery-hints.js";
import { CommandTaskTracker } from "../lib/task-tracker.js";
import { upsertActiveSession } from "../lib/session-store.js";
import { PI_ROUTINES_DIR, SYSTEM_STYLE_FILE } from "../lib/constants.js";
import { logWorkflowSpinnerTick, pollWorkflowUntilTerminal } from "../lib/workflow-client.js";
import type { WorkflowKey } from "../lib/workflow-poller.js";
import { writeAdapterFiles, type RoutineFormatId } from "../lib/routine-adapters-local.js";
import { collectRoutineRepoContext } from "../lib/routine-repo-context.js";
import {
  mergePrimaryAndReferenceRoutinePaths,
  parseRoutineIdsFromApiPayload,
  suggestRoutineIdsFromRepoContext,
} from "../lib/routine-context-detector.js";
import {
  ensureEmbeddedRoutinesOnDisk,
  expandExtraRoutineIdsForInjection,
} from "../lib/routine-injection-expansion.js";
import {
  applyTemplateDominanceRules,
  scoreEmbeddedTemplates,
} from "../lib/routine-template-suggest.js";
import { buildReferenceMap, getRoutineIndex, rebuildRoutineIndex } from "../lib/routine-index.js";
import { isEnhancedRoutineMarkdown, listRoutines, resolveRoutineFile } from "../lib/routine-library.js";
import { EMBEDDED_ROUTINE_TEMPLATES } from "../lib/embedded-templates.js";
import { getCurrentBranch, getPendingChanges } from "../lib/vcs/index.js";

async function writeRoutineFile(
  cwd: string,
  slug: string,
  markdown: string,
  version: number
): Promise<void> {
  const dir = path.join(cwd, PI_ROUTINES_DIR);
  await fs.mkdir(dir, { recursive: true });
  const outPath = path.join(dir, `${slug}.v${version}.md`);
  await fs.writeFile(outPath, markdown, "utf8");
  console.log(chalk.green("✓"), "Wrote routine:", path.relative(cwd, outPath));
}

/** Split v2 routine spec into per-phase markdown + .dag.json + .progress.json (progressive handoff). */
async function writeProgressiveRoutinePlan(
  cwd: string,
  slug: string,
  version: number,
  routine_spec_json: string | undefined
): Promise<void> {
  if (!routine_spec_json) return;
  let raw: unknown;
  try {
    raw = JSON.parse(routine_spec_json);
  } catch {
    return;
  }
  const spec = safeParseRoutineSpecification(raw);
  if (!spec) return;

  const safeSlug = slug.replace(/[^a-z0-9-_]/gi, "-");
  const base = path.join(cwd, PI_ROUTINES_DIR, safeSlug);
  await fs.mkdir(base, { recursive: true });

  const phaseMeta: { id: string; title: string; file: string }[] = [];
  let i = 0;
  for (const ph of spec.phases) {
    i += 1;
    const fileName = `phase-${i}-${ph.id.replace(/[^a-z0-9-_]/gi, "-")}.md`;
    phaseMeta.push({ id: ph.id, title: ph.title, file: fileName });
    const lines: string[] = [
      `# Phase ${i}: ${ph.title}`,
      "",
      `> Routine \`${slug}\` · v${version} — complete this phase only, run pi check, then: pi routine next ${safeSlug} --advance`,
      "",
    ];
    if (ph.depends_on_phases?.length) {
      lines.push(`**Depends on phases:** ${ph.depends_on_phases.join(", ")}`, "");
    }
    if (ph.unlock_condition) {
      lines.push(
        `**Unlock:** ${ph.unlock_condition.type}${ph.unlock_condition.details ? ` — ${ph.unlock_condition.details}` : ""}`,
        ""
      );
    }
    for (const st of ph.steps) {
      lines.push(`## ${st.id}`, "", st.description, "");
      if (st.depends_on_steps?.length) {
        lines.push(`_Depends on steps:_ ${st.depends_on_steps.join(", ")}`, "");
      }
    }
    await fs.writeFile(path.join(base, fileName), lines.join("\n"), "utf8");
    console.log(chalk.green("✓"), "Wrote", path.join(PI_ROUTINES_DIR, safeSlug, fileName));
  }

  await fs.writeFile(
    path.join(base, ".dag.json"),
    JSON.stringify({ routine: slug, version, phases: phaseMeta }, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(base, ".progress.json"),
    JSON.stringify(
      {
        routine: slug,
        version,
        unlocked_phase_index: 0,
      },
      null,
      2
    ),
    "utf8"
  );
}

async function writeExecutionPlanIfPresent(
  cwd: string,
  planSlug: string | undefined,
  planMarkdown: string | undefined
): Promise<void> {
  if (!planSlug?.trim() || planMarkdown === undefined) return;
  const dir = path.join(cwd, PI_ROUTINES_DIR);
  await fs.mkdir(dir, { recursive: true });
  const outPath = path.join(dir, `${planSlug.trim()}.md`);
  await fs.writeFile(outPath, planMarkdown, "utf8");
  console.log(chalk.green("✓"), "Wrote execution plan:", path.relative(cwd, outPath));
}

type RoutineGenOpts = PreFlightGlobalOpts & {
  approval?: boolean;
  async?: boolean;
  format?: RoutineFormatId[];
  withExcerpts?: boolean;
  /** Merge routine index ids scored from current branch + pending file paths into agent injection. */
  repoRoutines?: boolean;
};

type RoutineHandoffOpts = {
  includeRepoRoutineIds?: boolean;
};

function routineHandoffIncludeRepo(opts?: RoutineGenOpts): boolean {
  if (opts?.repoRoutines) return true;
  const e = process.env.PI_CLI_ROUTINE_REPO_CONTEXT?.trim().toLowerCase();
  return e === "1" || e === "true" || e === "yes";
}

function parseFormats(s?: string): RoutineFormatId[] | undefined {
  if (!s?.trim()) return undefined;
  const allowed = new Set<RoutineFormatId>(["cursor", "claude", "windsurf"]);
  const out: RoutineFormatId[] = [];
  for (const p of s.split(",")) {
    const x = p.trim().toLowerCase() as RoutineFormatId;
    if (allowed.has(x)) out.push(x);
  }
  return out.length ? out : undefined;
}

async function finalizeRoutineAgenticHandoff(
  cwd: string,
  slug: string,
  version: number,
  intent: string,
  apiPayloads: (Record<string, unknown> | undefined)[],
  handoffOpts?: RoutineHandoffOpts
): Promise<void> {
  const relRoutine = path.join(PI_ROUTINES_DIR, `${slug}.v${version}.md`).replace(/\\/g, "/");
  const apiIds = apiPayloads.flatMap((o) => parseRoutineIdsFromApiPayload(o));
  const suggested = suggestKnowledgeRoutineIds(intent);

  let repoIds: string[] = [];
  if (handoffOpts?.includeRepoRoutineIds) {
    const branch = await getCurrentBranch(cwd);
    const changed = await getPendingChanges(cwd);
    repoIds = await suggestRoutineIdsFromRepoContext(cwd, { branchName: branch, changedRelPaths: changed });
  }

  const baseExtra = [...new Set([...apiIds, ...suggested, ...repoIds])];
  const extraIds = expandExtraRoutineIdsForInjection(baseExtra);

  let routineRelPaths: string[] = [relRoutine];
  if (process.env.PI_CLI_NO_AGENTIC_INJECT !== "1") {
    try {
      await ensureEmbeddedRoutinesOnDisk(cwd, extraIds);
      await rebuildRoutineIndex(cwd);
      const entries = await getRoutineIndex(cwd);
      routineRelPaths = mergePrimaryAndReferenceRoutinePaths(slug, version, entries, extraIds);
      const inj = await injectPiContextToAllIDEs(cwd, { mode: "explicit", routineRelPaths });
      if (inj.filesWritten.length) {
        console.log(chalk.dim("Agentic IDE hints updated:"), inj.filesWritten.join(", "));
      }
    } catch {
      /* non-fatal */
    }
  }

  console.log("");
  console.log(chalk.bold("Handoff — only these routines (token-safe):"));
  for (const r of routineRelPaths) {
    console.log(chalk.cyan(`  · @${r}`));
  }
  console.log("");
  console.log(chalk.dim("Cursor (Composer):"), chalk.white(`Follow @${relRoutine}`));
  console.log(
    chalk.dim("Claude Code / Codex / terminal agents:"),
    chalk.white(`claude "Execute the steps in ${relRoutine}"`)
  );
  console.log(chalk.dim("Windsurf:"), chalk.white("see .windsurf/rules/pi-context.md when present"));
  console.log("");

  if (process.stdin.isTTY) {
    try {
      const clip = [
        "Follow only these Pi routines (do not load unrelated files under .pi/routines/):",
        ...routineRelPaths.map((r) => `- @${r}`),
      ].join("\n");
      await clipboard.write(clip);
      console.log(chalk.yellow("📋 Routine handoff copied to clipboard."));
    } catch {
      console.log(chalk.gray("(Clipboard unavailable — copy the lines above.)"));
    }
  }
}

function suggestKnowledgeRoutineIds(intent: string): string[] {
  const q = intent.toLowerCase();
  const out = new Set<string>();

  // UI/UX general hub
  if (/(ui\/?ux|user experience|usability|a11y|accessib|design system|visual design|color theory|information architecture|copywriting|microcopy)/.test(q)) {
    out.add("ui-ux-playbook");
  }

  // React composition patterns
  if (/(compound component|compound-components|composition|boolean prop|render props?|prop drilling|context (?:provider)?|lift state|provider|variants?)/.test(q)) {
    out.add("react-composition-playbook");
  }

  // React performance / best practices pack (waterfalls, bundles, RSC, rerenders)
  if (/(waterfall|sequential await|promise\.all|paralleliz|suspense|bundle|dynamic import|code split|barrel import|optimizepackageimports|rsc|server action|react\.cache|lru cache|hydration|useDeferredValue|startTransition|perf|performance|lcp|tti)/.test(q)) {
    out.add("react-best-practices-playbook");
  }

  // React Native / Expo mobile skills
  if (/(react native|react-native|\bexpo\b|expo-router|flatlist|flashlist|legendlist|reanimated|gesture-handler|native-stack|native tabs|zeego|galeria|expo-image|pressable|scrollview)/.test(q)) {
    out.add("react-native-skills-playbook");
  }

  // React View Transitions API (React `<ViewTransition>`, Next.js experimental.viewTransition, Link transitionTypes)
  if (
    /\bview transitions?\b|viewtransition|addtransitiontype|transitiontypes|startviewtransition|::view-transition|shared element transitions?|morph-forward|nav-forward|nav-back|experimental\.viewtransition|view-transition-name/.test(
      q
    )
  ) {
    out.add("react-view-transitions-playbook");
  }

  // shadcn
  if (/(shadcn|radix|cva|class-variance-authority)/.test(q)) {
    out.add("shadcn-ui-playbook");
  }

  // Chakra
  if (/(chakra|style props|css-in-js runtime)/.test(q)) {
    out.add("chakra-ui-playbook");
  }

  // MUI / Material
  if (/(mui|material ui|material-ui|slot props?|slot strategy|componentsprops|sx prop)/.test(q)) {
    out.add("mui-customization-slot-strategy");
  }

  // library selection
  if (/(choose|select|pick).*(ui library|component library)|react ui librar|design library/.test(q)) {
    out.add("react-ui-libraries-2025");
  }

  // Generic fallback: match against all embedded templates by metadata.
  // This is what makes the previous ~40 templates usable without manual import.
  for (const id of scoreEmbeddedTemplates(intent, EMBEDDED_ROUTINE_TEMPLATES, 3)) out.add(id);

  applyTemplateDominanceRules(out, intent);

  return [...out];
}

export async function runRoutineGenerate(
  cwd: string,
  intent: string,
  docUrls: string[],
  opts?: RoutineGenOpts
): Promise<void> {
  await ensurePiDir(cwd, opts);
  await ensureTeamSyncIfNeeded(cwd, opts);
  await ensureSystemStyleJson(cwd, opts);

  const client = new PiApiClient();

  let system_style: Record<string, unknown> | undefined;
  try {
    const raw = await fs.readFile(path.join(cwd, SYSTEM_STYLE_FILE), "utf8");
    system_style = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    system_style = undefined;
  }

  const branch_name = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const developer_id = process.env.PI_CLI_DEVELOPER_ID?.trim() || undefined;

  const tracker = new CommandTaskTracker("routine", `Routine: ${intent.slice(0, 120)}`, {
    cwd,
    branch: branch_name,
  });
  tracker.startStep("context", "Collect routine repo context");
  const routine_context = await collectRoutineRepoContext(cwd, intent, {
    withExcerpts: Boolean(opts?.withExcerpts),
  });
  tracker.completeStep("context");
  tracker.startStep("api", "Generate routine (API)");

  const useAsync = Boolean(opts?.async) || process.env.PI_CLI_ASYNC === "true";

  const res = await client.routineGenerate(
    {
      intent,
      system_style,
      doc_urls: docUrls.length ? docUrls : undefined,
      require_approval: Boolean(opts?.approval),
      branch_name,
      developer_id,
      routine_context,
      format: opts?.format,
    },
    { async: useAsync }
  );

  /** After async queue, poll until suspended or success */
  let effective: Record<string, unknown> = { ...res };
  let workflowResultRaw: Record<string, unknown> | undefined;
  if (res.async && res.run_id && res.workflow_key) {
    tracker.linkWorkflowRun(res.run_id);
    let done: Awaited<ReturnType<typeof pollWorkflowUntilTerminal>>;
    try {
      process.stdout.write("\n");
      done = await pollWorkflowUntilTerminal(client, res.workflow_key as WorkflowKey, res.run_id, {
        onTick: (n, ms) => logWorkflowSpinnerTick(n, ms),
      });
    } catch (e) {
      tracker.fail(e);
      console.error(chalk.red(e instanceof Error ? e.message : String(e)));
      printPickUpWhereYouLeftOff({ workflowRunId: res.run_id, cliRetryHint: 'pi routine "<intent>" --async' });
      process.exitCode = 1;
      return;
    }
    console.log("");
    if (done.status === "suspended") {
      effective = {
        status: "suspended",
        run_id: res.run_id,
        workflow_key: res.workflow_key,
        suspend_payload: done.suspend_payload ?? (done.workflow_run as { suspendPayload?: unknown })?.suspendPayload,
        thread_id: res.thread_id,
      };
    } else if (done.status === "success") {
      workflowResultRaw = done.workflow_result as Record<string, unknown> | undefined;
      const raw = workflowResultRaw;
      const out = raw?.markdown
        ? (raw as { slug?: string; markdown?: string; version?: number; routine_spec_json?: string })
        : (raw?.result as
            | { slug?: string; markdown?: string; version?: number; routine_spec_json?: string }
            | undefined);
      if (out?.markdown !== undefined) {
        effective = {
          slug: out.slug ?? "routine",
          markdown: out.markdown,
          version: out.version ?? 1,
          status: "completed",
          run_id: res.run_id,
          workflow_key: res.workflow_key,
          thread_id: res.thread_id,
          routine_spec_json: out.routine_spec_json,
          execution_plan_markdown: (out as { execution_plan_markdown?: string }).execution_plan_markdown,
          execution_plan_slug: (out as { execution_plan_slug?: string }).execution_plan_slug,
        };
      }
    } else {
      tracker.fail(new Error(`Routine workflow: ${done.status}`));
      console.error(chalk.red("Routine workflow failed:"), done.status);
      printPickUpWhereYouLeftOff({ workflowRunId: res.run_id, cliRetryHint: 'pi routine "<intent>" --async' });
      process.exitCode = 1;
      return;
    }
  }

  if (effective.status === "suspended" && effective.run_id && opts?.approval) {
    const draft =
      (effective.suspend_payload as { draft_markdown?: string } | undefined)?.draft_markdown ?? "";
    console.log(chalk.cyan("\n--- Draft routine ---\n"));
    console.log(draft);
    const approved = await confirm({
      message: "Approve this routine?",
      initialValue: true,
    });
    if (isCancel(approved)) {
      console.log(chalk.gray("Cancelled."));
      return;
    }
    const resumed = await client.workflowResume({
      workflow_key: "cliRoutineWorkflow",
      run_id: effective.run_id as string,
      step_id: "human-approval",
      resume_data: { approved, feedback: undefined },
    });
    type RoutineOut = {
      slug?: string;
      markdown?: string;
      version?: number;
      routine_spec_json?: string;
      execution_plan_markdown?: string;
      execution_plan_slug?: string;
    };
    const wr = resumed.workflow_result as Record<string, unknown> | RoutineOut | undefined;
    const inner = wr && typeof wr === "object" && "result" in wr && wr.result && typeof wr.result === "object"
      ? (wr.result as RoutineOut)
      : (wr as RoutineOut | undefined);
    if (inner?.markdown) {
      tracker.completeStep("api");
      tracker.startStep("write", "Write routine files");
      const slug = inner.slug ?? "routine";
      const version = inner.version ?? 1;
      await writeRoutineFile(cwd, slug, inner.markdown, version);
      await writeProgressiveRoutinePlan(cwd, slug, version, inner.routine_spec_json);
      await writeExecutionPlanIfPresent(cwd, inner.execution_plan_slug, inner.execution_plan_markdown);
      await writeAdapterFiles(cwd, slug, inner.routine_spec_json, opts?.format ?? []);
      await finalizeRoutineAgenticHandoff(cwd, slug, version, intent, [inner as Record<string, unknown>], {
        includeRepoRoutineIds: routineHandoffIncludeRepo(opts),
      });
      tracker.completeStep("write");
      tracker.complete();
      
      // Create lightweight session for routine command
      const sessionId = `routine-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      upsertActiveSession({
        cwd,
        branch_name,
        session_id: sessionId,
        intent_summary: intent.slice(0, 200),
        status: "resolved",
        last_user_message: intent,
        last_pi_message: `Generated routine: ${slug}`,
      });
      
      return;
    }
    console.log(chalk.yellow("Workflow did not complete as expected; see JSON:"));
    console.log(JSON.stringify(resumed, null, 2));
    tracker.fail(new Error("Routine workflow incomplete after approval"));
    return;
  }

  if (!effective.slug || effective.markdown === undefined) {
    tracker.fail(new Error("Unexpected routine response"));
    console.error(chalk.red("Unexpected routine response."), effective);
    process.exitCode = 1;
    return;
  }

  const { slug, markdown, version, routine_spec_json, execution_plan_markdown, execution_plan_slug } = effective as {
    slug: string;
    markdown: string;
    version: number;
    routine_spec_json?: string;
    execution_plan_markdown?: string;
    execution_plan_slug?: string;
  };
  tracker.completeStep("api");
  tracker.startStep("write", "Write routine files");
  await writeRoutineFile(cwd, slug, markdown, version);
  await writeProgressiveRoutinePlan(cwd, slug, version, routine_spec_json);
  await writeExecutionPlanIfPresent(cwd, execution_plan_slug, execution_plan_markdown);

  const specJson =
    routine_spec_json ??
    (res as { routine_spec_json?: string }).routine_spec_json ??
    (effective as { routine_spec_json?: string }).routine_spec_json;

  if (opts?.format?.length) {
    await writeAdapterFiles(cwd, slug, specJson, opts.format);
  }

  await finalizeRoutineAgenticHandoff(
    cwd,
    slug,
    version,
    intent,
    [effective as Record<string, unknown>, res as Record<string, unknown>, workflowResultRaw],
    { includeRepoRoutineIds: routineHandoffIncludeRepo(opts) }
  );
  tracker.completeStep("write");
  tracker.complete();
  
  // Create lightweight session for routine command
  const sessionId = `routine-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  upsertActiveSession({
    cwd,
    branch_name,
    session_id: sessionId,
    intent_summary: intent.slice(0, 200),
    status: "resolved",
    last_user_message: intent,
    last_pi_message: `Generated routine: ${slug}`,
  });
}

function tokenizeSearch(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((w) => w.length > 1);
}

export async function runRoutineIndexCommand(cwd: string): Promise<void> {
  const n = await rebuildRoutineIndex(cwd);
  console.log(chalk.green("✓"), `Routine index rebuilt (${n.length} entr${n.length === 1 ? "y" : "ies"}).`);
}

export async function runRoutineStats(cwd: string): Promise<void> {
  const entries = await getRoutineIndex(cwd);
  const rev = buildReferenceMap(entries);
  if (!entries.length) {
    console.log(chalk.gray("No routines in index."));
    return;
  }
  let refSum = 0;
  for (const e of entries) refSum += e.references.length;
  const avgRef = entries.length ? (refSum / entries.length).toFixed(2) : "0";
  let topId = "";
  let topN = 0;
  for (const [id, refs] of rev) {
    if (refs.length > topN) {
      topN = refs.length;
      topId = id;
    }
  }
  console.log(chalk.bold.cyan("\nPi routine library\n"));
  console.log(`Total routines: ${entries.length}`);
  console.log(`Avg references per routine: ${avgRef}`);
  if (topId) console.log(`Most referenced: ${topId} (${topN} incoming)`);
  console.log("");
}

export async function runRoutineSearch(cwd: string, query: string): Promise<void> {
  const tokens = tokenizeSearch(query);
  const entries = await getRoutineIndex(cwd);
  const scored = entries
    .map((e) => {
      const hay = `${e.id} ${e.intent} ${e.tags.join(" ")}`.toLowerCase();
      let s = 0;
      for (const t of tokens) if (hay.includes(t)) s += 1;
      return { e, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
  if (!scored.length) {
    console.log(chalk.gray("No matches."));
    return;
  }
  for (const { e } of scored) {
    console.log(`${chalk.bold(e.id)}  ${e.file_path}`);
    console.log(chalk.dim(`  ${e.intent.slice(0, 120)}${e.intent.length > 120 ? "…" : ""}`));
  }
}

export async function runRoutineList(cwd: string, opts?: { tags?: string[] }): Promise<void> {
  const entries = await listRoutines(cwd, opts?.tags?.length ? { tags: opts.tags } : undefined);
  let indexEntries: Awaited<ReturnType<typeof getRoutineIndex>> = [];
  try {
    indexEntries = await getRoutineIndex(cwd);
  } catch {
    indexEntries = [];
  }
  const byFile = new Map(indexEntries.map((x) => [path.basename(x.file_path), x]));
  const rev = buildReferenceMap(indexEntries);

  if (!entries.length) {
    console.log(chalk.gray("No routines yet."));
    return;
  }
  for (const e of entries) {
    const tagStr = e.tags.length ? chalk.dim(` [${e.tags.join(", ")}]`) : "";
    const flag = e.enhanced ? chalk.green("v2") : chalk.yellow("v1");
    const ix = byFile.get(e.filename);
    const fileCount = ix?.files_manifest?.length ?? 0;
    const incoming = rev.get(e.id)?.length ?? 0;
    const refLine =
      incoming > 0 ? chalk.dim(`  → Referenced by: ${rev.get(e.id)!.join(", ")}`) : chalk.dim(`  → Referenced by: —`);
    console.log(`${e.filename}  ${flag}${tagStr}  id=${e.id}`);
    console.log(chalk.dim(`  → Files in manifest: ${fileCount}`));
    console.log(refLine);
  }
}

export async function runRoutineShow(cwd: string, slugOrFile: string): Promise<void> {
  const abs = await resolveRoutineFile(cwd, slugOrFile);
  if (!abs) {
    console.error(chalk.red("Routine not found:", slugOrFile));
    process.exitCode = 1;
    return;
  }
  const raw = await fs.readFile(abs, "utf8");
  console.log(chalk.cyan(path.relative(cwd, abs)));
  console.log(raw);
}

export async function runRoutineUpgrade(cwd: string, fileArg: string): Promise<void> {
  const abs = path.isAbsolute(fileArg) ? fileArg : path.join(cwd, fileArg);
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch {
    console.error(chalk.red("Cannot read file:", fileArg));
    process.exitCode = 1;
    return;
  }
  if (isEnhancedRoutineMarkdown(raw)) {
    console.log(chalk.green("Already Pi routine v2 (YAML frontmatter). No upgrade needed."));
    return;
  }
  const client = new PiApiClient();
  const out = await client.routineUpgrade({
    legacy_markdown: raw,
    intent_hint: raw.slice(0, 500),
  });
  await writeRoutineFile(cwd, out.slug, out.markdown, out.version);
  await finalizeRoutineAgenticHandoff(cwd, out.slug, out.version, "", [out as Record<string, unknown>], {
    includeRepoRoutineIds: routineHandoffIncludeRepo(undefined),
  });
  console.log(chalk.gray("Upgrade complete. Review the new structured routine in .pi/routines/."));
}

export { parseFormats };
