import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { detectRoutineDrift, type DriftViolation } from "pi-routine-spec";
import { createSharinganProject } from "../lib/ast/sharingan.js";
import {
  buildValidateCloudFingerprint,
  RasenganCache,
  sha256Hex,
  validateCloudCacheKey,
} from "../lib/cache/rasengan-cache.js";
import { recordValidateApiCall } from "../lib/token-budget.js";
import { redactSource } from "../lib/privacy/redactor.js";
import { runDeterministicRulesWithContext, type RuleViolation } from "../lib/rules/deterministic.js";
import { buildDefaultRuleRuntimeContext, shouldIgnoreFile } from "../lib/rules/rule-loader.js";
import { loadCustomRuleModules, runCustomRules } from "../lib/rules/custom-rules.js";
import { POLYGLOT_VALIDATE_PATH } from "../lib/rules/polyglot-extensions.js";
import { scanPolyglotFile } from "../lib/rules/polyglot-rules.js";
import {
  generateDeterministicPatches,
  type DeterministicPatch,
} from "../lib/rules/patch-generator.js";
import { PiApiClient } from "../lib/api-client.js";
import { getPersona } from "../lib/config.js";
import { PI_CONSTITUTION_FILE, SYSTEM_STYLE_FILE, PI_LAST_VALIDATE_RESULT } from "../lib/constants.js";
import { formatCommandBlock } from "../lib/persona.js";
import { readPiProjectConfig } from "../lib/pi-project-config.js";
import { touchValidateActivity } from "../lib/cli-activity.js";
import { ensureValidatePreflight, type PreFlightGlobalOpts } from "../lib/dependency-chain.js";
import { buildRoutineSpecForDriftFromMarkdown } from "../lib/routine-index.js";
import { resolveRoutineFile } from "../lib/routine-library.js";
import { printPickUpWhereYouLeftOff } from "../lib/recovery-hints.js";
import { getTaskById } from "../lib/task-store.js";
import { CommandTaskTracker } from "../lib/task-tracker.js";
import { upsertActiveSession } from "../lib/session-store.js";
import {
  getChangedFiles,
  getChangedHunksLegacy,
  getCurrentBranch,
  getLastCommitMessage,
  getPendingChanges,
} from "../lib/vcs/index.js";
import { logWorkflowSpinnerTick, pollWorkflowUntilTerminal } from "../lib/workflow-client.js";
import type { WorkflowKey } from "../lib/workflow-poller.js";

async function fileExists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

async function loadRoutineMarkdown(cwd: string, intent: string | undefined): Promise<string | undefined> {
  if (!intent) return undefined;
  const abs = await resolveRoutineFile(cwd, intent);
  if (!abs) return undefined;
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    return undefined;
  }
}

async function detectRoutineIdFromVcs(cwd: string): Promise<string | undefined> {
  try {
    const branch = await getCurrentBranch(cwd);
    const bm = branch?.match(/(?:feature|fix|routine)\/([a-z0-9-]+)/i);
    if (bm?.[1]) return bm[1].toLowerCase();
    const subj = (await getLastCommitMessage(cwd)) ?? "";
    const rm = subj.match(/(?:routine|pi-routine)[#:\s]+([a-z0-9][a-z0-9-]*)/i);
    if (rm?.[1]) return rm[1].toLowerCase();
  } catch {
    return undefined;
  }
  return undefined;
}

function routineVersionToken(routineMarkdown: string | undefined): string {
  if (!routineMarkdown) return "none";
  return createHash("sha256").update(routineMarkdown).digest("hex").slice(0, 24);
}

export async function runValidate(
  cwd: string,
  opts: {
    intent?: string;
    paths?: string[];
    json?: boolean;
    strict?: boolean;
    since?: "staged" | "head";
    debugRun?: string;
    async?: boolean;
    hunksOnly?: boolean;
    routine?: string;
    autoDetectRoutine?: boolean;
    /** Skip L2 cloud validate cache (always call API). */
    noCache?: boolean;
    /** default | json | patches (patches = JSON with machine-readable diffs for local rules). */
    outputFormat?: "default" | "json" | "patches";
    /** Bypass hourly validate API budget (PI_CLI_MAX_API_CALLS_PER_HOUR). */
    force?: boolean;
  } & PreFlightGlobalOpts
): Promise<void> {
  const client = new PiApiClient();
  const cache = new RasenganCache(cwd);

  if (opts.debugRun) {
    const dbg = await client.validateDebug({ run_id: opts.debugRun });
    console.log(JSON.stringify(dbg.snapshot, null, 2));
    return;
  }

  const branch_for_tasks = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const tracker = new CommandTaskTracker(
    "validate",
    opts.intent ? `Validate: ${opts.intent}` : "Validate changes",
    {
      cwd,
      branch: branch_for_tasks,
      files: opts.paths,
    }
  );
  tracker.startStep("preflight", "Preflight (init / sync / learn)");
  await ensureValidatePreflight(cwd, {
    noAuto: opts.noAuto,
    skipLearn: opts.skipLearn,
    skipSync: opts.skipSync,
    requireLearn: opts.requireLearn,
  });
  tracker.completeStep("preflight");

  const fmt = opts.outputFormat ?? (opts.json ? "json" : "default");

  if (fmt === "default") {
    const styleOk = await fileExists(path.join(cwd, SYSTEM_STYLE_FILE));
    const constOk = await fileExists(path.join(cwd, PI_CONSTITUTION_FILE));
    console.log(chalk.bold.cyan("Pi validate — context"));
    console.log(
      chalk.dim("  system-style:"),
      styleOk ? chalk.green(SYSTEM_STYLE_FILE) : chalk.yellow(`${SYSTEM_STYLE_FILE} (missing — run pi learn)`)
    );
    console.log(
      chalk.dim("  constitution:"),
      constOk ? chalk.green(PI_CONSTITUTION_FILE) : chalk.yellow(`${PI_CONSTITUTION_FILE} (missing — run pi init)`)
    );
  }

  const routineTarget =
    opts.routine?.trim() || (opts.autoDetectRoutine ? await detectRoutineIdFromVcs(cwd) : undefined);

  let driftViolations: DriftViolation[] = [];
  if (routineTarget) {
    const abs = await resolveRoutineFile(cwd, routineTarget);
    if (!abs) {
      tracker.fail(new Error(`Routine not found for drift: ${routineTarget}`));
      console.error(chalk.red(`Routine not found for drift: ${routineTarget}`));
      process.exitCode = 1;
      return;
    }
    if (fmt === "default") {
      console.log(chalk.dim("  routine (drift):"), chalk.green(path.relative(cwd, abs).replace(/\\/g, "/")));
    }
    const md = await fs.readFile(abs, "utf8");
    const spec = buildRoutineSpecForDriftFromMarkdown(md, routineTarget);
    let changedRel: string[] = [];
    if (opts.paths?.length) {
      changedRel = opts.paths.map((p) => path.relative(cwd, path.resolve(cwd, p)).replace(/\\/g, "/"));
    } else if (opts.since === "staged") {
      changedRel = (await getPendingChanges(cwd)).map((f) => f.replace(/\\/g, "/"));
    } else {
      changedRel = (await getChangedFiles(cwd, "HEAD")).map((f) => f.replace(/\\/g, "/"));
    }
    const fileContents = new Map<string, string>();
    for (const rel of changedRel) {
      try {
        const full = path.join(cwd, rel);
        const t = await fs.readFile(full, "utf8");
        fileContents.set(rel, t);
      } catch {
        /* skip binary */
      }
    }
    driftViolations = detectRoutineDrift(changedRel, spec, { fileContents });
  } else if (fmt === "default") {
    console.log(chalk.dim("  routine (drift):"), chalk.gray("— (pass --routine <id> or --auto-detect-routine)"));
  }

  let files: string[] = [];
  if (opts.paths?.length) {
    files = opts.paths.map((p) => path.resolve(cwd, p));
  } else if (opts.since === "staged") {
    files = (await getPendingChanges(cwd))
      .map((f) => path.resolve(cwd, f))
      .filter((f) => /\.(tsx?|jsx?)$/i.test(f) || POLYGLOT_VALIDATE_PATH.test(f));
  } else {
    const rel = await getChangedFiles(cwd, "HEAD");
    files = rel
      .map((f) => path.resolve(cwd, f))
      .filter((f) => /\.(tsx?|jsx?)$/i.test(f) || POLYGLOT_VALIDATE_PATH.test(f));
  }

  if (!files.length && !routineTarget) {
    tracker.skipStep("deterministic");
    tracker.skipStep("cloud");
    tracker.complete();
    if (fmt === "json") {
      console.log(
        JSON.stringify({ drift: [], local: [], semantic: [], summary: null }, null, 2)
      );
    } else if (fmt === "patches") {
      console.log(
        JSON.stringify(
          {
            drift: [],
            local: [],
            semantic: [],
            summary: null,
            patches: [],
            autofix_available: false,
          },
          null,
          2
        )
      );
    } else {
      console.log(chalk.gray("No matching files to validate."));
    }
    await touchValidateActivity(cwd, true);
    return;
  }

  tracker.startStep("gather", "Gather files and drift context");
  tracker.completeStep("gather");
  tracker.startStep("deterministic", "Sharingan deterministic rules");

  const tsFiles = files.filter((f) => /\.(tsx?|jsx?)$/i.test(f));
  const polyFiles = files.filter((f) => POLYGLOT_VALIDATE_PATH.test(f));

  const sharingan = createSharinganProject(cwd);
  const sourceFiles = tsFiles.length ? sharingan.addSourceFiles(tsFiles) : [];

  const intentForRoutine = opts.intent ?? routineTarget;
  const routine_markdown = await loadRoutineMarkdown(cwd, intentForRoutine);
  const routineTok = routineVersionToken(routine_markdown);
  const intentKey = intentForRoutine ?? "";

  const ruleCtx = await buildDefaultRuleRuntimeContext(cwd);
  const polyEnabled = (id: string) => ruleCtx.states.get(id)?.enabled ?? false;
  const mapSev = (v: RuleViolation): RuleViolation => {
    const st = ruleCtx.states.get(v.rule);
    const sev = st?.severity ?? v.severity;
    return {
      ...v,
      severity: sev === "info" ? "info" : sev === "error" ? "error" : "warning",
    };
  };

  if (fmt === "default") {
    if (intentForRoutine && routine_markdown) {
      console.log(
        chalk.dim("  routine (API / semantic):"),
        chalk.green(`loaded for intent “${intentForRoutine.slice(0, 80)}${intentForRoutine.length > 80 ? "…" : ""}”`)
      );
    } else if (intentForRoutine) {
      console.log(chalk.dim("  routine (API / semantic):"), chalk.yellow(`no markdown resolved for “${intentForRoutine}”`));
    } else {
      console.log(chalk.dim("  routine (API / semantic):"), chalk.gray("— (optional intent for cloud check)"));
    }
    console.log("");
  }

  const local: RuleViolation[] = [];
  for (const sf of sourceFiles) {
    const text = sf.getFullText();
    const { redacted } = redactSource(text);
    const snap = `${text.length}:${redacted.slice(0, 80)}`;
    const ck = `validate:${sf.getFilePath()}:${snap}:${intentKey}:${routineTok}`;
    const hit = await cache.get<RuleViolation[]>(ck);
    if (hit) {
      local.push(...hit);
      continue;
    }
    const v = runDeterministicRulesWithContext(sf, ruleCtx);
    local.push(...v);
    await cache.set(ck, v, 3600_000);
  }

  for (const pf of polyFiles) {
    const rel = path.relative(cwd, pf).replace(/\\/g, "/");
    if (shouldIgnoreFile(rel, ruleCtx.ignorePatterns)) continue;
    let text: string;
    try {
      text = await fs.readFile(pf, "utf8");
    } catch {
      continue;
    }
    const { redacted } = redactSource(text);
    const snap = `${text.length}:${redacted.slice(0, 80)}`;
    const ck = `validate:${pf}:${snap}:${intentKey}:${routineTok}`;
    const hit = await cache.get<RuleViolation[]>(ck);
    if (hit) {
      local.push(...hit);
      continue;
    }
    const v = scanPolyglotFile(pf, text, polyEnabled).map(mapSev);
    local.push(...v);
    await cache.set(ck, v, 3600_000);
  }

  try {
    const mods = await loadCustomRuleModules(cwd);
    const custom = await runCustomRules(cwd, files, mods);
    local.push(...custom.map(mapSev));
  } catch {
    /* optional custom rules */
  }

  const deterministicPatches: DeterministicPatch[] = [];
  for (const sf of sourceFiles) {
    const vf = local.filter((vi) => vi.file === sf.getFilePath());
    deterministicPatches.push(...generateDeterministicPatches(sf, vf));
  }

  let file_excerpts: { path: string; excerpt: string }[];

  if (!files.length) {
    file_excerpts = [];
  } else if (opts.hunksOnly) {
    const hunksByFile = await getChangedHunksLegacy(cwd, opts.since === "staged" ? "staged" : "head");
    const map = new Map(hunksByFile.map((h) => [h.file.replace(/\\/g, "/"), h]));
    file_excerpts = await Promise.all(
      files.slice(0, 15).map(async (file) => {
        const rel = path.relative(cwd, file).replace(/\\/g, "/");
        const hunk = map.get(rel);
        const raw = await fs.readFile(file, "utf8");
        let slice = raw;
        if (hunk?.hunks.length) {
          const lines = raw.split("\n");
          const ranges = hunk.hunks.map((h) => ({
            start: Math.max(1, h.startLine - 3),
            end: Math.min(lines.length, h.endLine + 3),
          }));
          const out: string[] = [];
          for (const r of ranges) {
            out.push(lines.slice(r.start - 1, r.end).join("\n"));
          }
          slice = out.join("\n\n---\n\n");
        }
        const { redacted } = redactSource(slice);
        return {
          path: rel,
          excerpt: redacted.slice(0, 8000),
        };
      })
    );
  } else {
    file_excerpts = await Promise.all(
      files.slice(0, 15).map(async (file) => {
        const raw = await fs.readFile(file, "utf8");
        const { redacted } = redactSource(raw);
        return {
          path: path.relative(cwd, file),
          excerpt: redacted.slice(0, 8000),
        };
      })
    );
  }

  tracker.completeStep("deterministic");
  tracker.startStep("cloud", "Cloud semantic validation (Byakugan)");

  const branch_name = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const developer_id = process.env.PI_CLI_DEVELOPER_ID?.trim() || undefined;

  const useAsync = Boolean(opts.async) || process.env.PI_CLI_ASYNC === "true";

  let systemStyleDigest = "missing";
  try {
    const styleRaw = await fs.readFile(path.join(cwd, SYSTEM_STYLE_FILE), "utf8");
    systemStyleDigest = sha256Hex(styleRaw).slice(0, 32);
  } catch {
    /* no system-style */
  }

  const cloudCacheDisabled =
    Boolean(opts.noCache) || process.env.PI_CLI_DISABLE_VALIDATE_CACHE === "true";
  const cloudFp = buildValidateCloudFingerprint({
    intentKey: intentKey,
    routineTok,
    systemStyleDigest,
    branchName: branch_name,
    developerId: developer_id ?? "",
    localViolationsJson: JSON.stringify(local),
    fileExcerpts: file_excerpts,
    hunksOnly: Boolean(opts.hunksOnly),
  });
  const cloudCacheKey = validateCloudCacheKey(cloudFp);
  const validateCacheTtl = Number(process.env.PI_CLI_VALIDATE_CACHE_TTL_MS ?? "3600000") || 3600_000;

  type CachedCloud = {
    semantic_violations: { rule: string; severity: string; message: string; suggestion?: string }[];
    summary: string | null;
    adaptive_recommended?: boolean;
    thread_id?: string;
    workflow?: string | null;
  };

  let merged: Awaited<ReturnType<PiApiClient["validate"]>>;
  try {
    merged = await (async () => {
      if (!cloudCacheDisabled && !useAsync) {
        const hit = await cache.get<CachedCloud>(cloudCacheKey);
        if (hit) {
          if (fmt === "default") {
            console.log(chalk.dim("  cloud cache:"), chalk.green("hit (Rasengan circuit breaker — skipped API)"));
            console.log("");
          }
          return {
            local_violations: local,
            semantic_violations: hit.semantic_violations,
            summary: hit.summary ?? null,
            adaptive_recommended: hit.adaptive_recommended ?? false,
            thread_id: hit.thread_id,
            workflow: hit.workflow ?? null,
          };
        }
      }

      const allowForce = Boolean(opts.force) || process.env.PI_CLI_FORCE_VALIDATE === "true";
      if (!allowForce) {
        const bud = await recordValidateApiCall(cwd);
        if (!bud.ok) {
          throw new Error(bud.warn ?? "Validate API budget exceeded.");
        }
        if (bud.warn && fmt === "default") {
          console.log(chalk.yellow(bud.warn));
        }
      }

      const first = await client.validate(
        {
          intent: intentForRoutine,
          branch_name,
          developer_id,
          local_violations: local,
          routine_markdown,
          file_excerpts,
        },
        { async: useAsync }
      );

      if (first.async && first.run_id && first.workflow_key) {
        tracker.linkWorkflowRun(first.run_id);
        process.stdout.write("\n");
        const done = await pollWorkflowUntilTerminal(
          client,
          first.workflow_key as WorkflowKey,
          first.run_id,
          { onTick: (n, ms) => logWorkflowSpinnerTick(n, ms) }
        );
        console.log("");
        if (done.status !== "success") {
          throw new Error(`Validate workflow finished with status: ${done.status}`);
        }
        const wr = done.workflow_result as
          | {
              semantic_violations: { rule: string; severity: string; message: string; suggestion?: string }[];
              summary?: string | null;
              adaptive_recommended?: boolean;
            }
          | undefined;
        const out = {
          local_violations: local,
          semantic_violations: wr?.semantic_violations ?? [],
          summary: wr?.summary ?? null,
          adaptive_recommended: wr?.adaptive_recommended ?? false,
          thread_id: first.thread_id,
          workflow: first.workflow_key,
        };
        if (!cloudCacheDisabled) {
          await cache.set(
            cloudCacheKey,
            {
              semantic_violations: out.semantic_violations,
              summary: out.summary,
              adaptive_recommended: out.adaptive_recommended,
              thread_id: out.thread_id,
              workflow: out.workflow ?? null,
            } satisfies CachedCloud,
            validateCacheTtl
          );
        }
        return out;
      }

      if (!cloudCacheDisabled && !first.async) {
        await cache.set(
          cloudCacheKey,
          {
            semantic_violations: first.semantic_violations ?? [],
            summary: first.summary ?? null,
            adaptive_recommended: first.adaptive_recommended,
            thread_id: first.thread_id,
            workflow: first.workflow ?? null,
          } satisfies CachedCloud,
          validateCacheTtl
        );
      }

      return first;
    })();
  } catch (e) {
    tracker.failStep("cloud", e);
    tracker.fail(e);
    console.error(chalk.red(e instanceof Error ? e.message : String(e)));
    const wf = getTaskById(tracker.rootTaskId)?.context.workflow_run_id;
    printPickUpWhereYouLeftOff({
      workflowRunId: wf,
      cliRetryHint: "pi validate" + (opts.async ? " --async" : ""),
    });
    process.exitCode = 1;
    return;
  }

  tracker.completeStep("cloud");
  tracker.complete();

  const semantic = merged.semantic_violations ?? [];
  const all: { severity: string }[] = [...local, ...semantic.map((s) => ({ ...s, severity: s.severity }))];

  // Create lightweight session for validate command
  const sessionIntent = opts.intent || "Validate codebase";
  const sessionId = `validate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  upsertActiveSession({
    cwd,
    branch_name: branch_for_tasks,
    session_id: sessionId,
    intent_summary: sessionIntent,
    status: "resolved",
    thread_id: `local-validate-${sessionId}`,
    last_pi_message: `Validated ${files.length} files. Found ${all.length} violations.`,
    messages: [
      { role: "user", content: sessionIntent },
      {
        role: "assistant",
        content: `Validated ${files.length} files. Found ${all.length} violations.`,
      },
    ],
  });

  // Auto-write validation results for downstream consumption by resonate/fix
  const lastValidateResult = {
    timestamp: new Date().toISOString(),
    drift: driftViolations,
    local,
    semantic: merged.semantic_violations,
    summary: merged.summary,
    patches: deterministicPatches,
    autofix_available: deterministicPatches.length > 0,
    files_checked: files.map((f) => path.relative(cwd, f)),
    routine: routineTarget,
  };
  try {
    await fs.writeFile(
      path.join(cwd, PI_LAST_VALIDATE_RESULT),
      JSON.stringify(lastValidateResult, null, 2),
      "utf8"
    );
  } catch (e) {
    // Non-fatal: don't block validate if we can't write the result cache
    if (fmt === "default") {
      console.log(chalk.yellow(`⚠ Could not write ${PI_LAST_VALIDATE_RESULT}: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  if (fmt === "json" || fmt === "patches") {
    if (fmt === "patches") {
      console.log(
        JSON.stringify(
          {
            drift: driftViolations,
            local,
            semantic: merged.semantic_violations,
            summary: merged.summary,
            patches: deterministicPatches,
            autofix_available: deterministicPatches.length > 0,
          },
          null,
          2
        )
      );
    } else {
      console.log(
        JSON.stringify(
          {
            drift: driftViolations,
            local,
            semantic: merged.semantic_violations,
            summary: merged.summary,
          },
          null,
          2
        )
      );
    }
    const strictFailJson = Boolean(
      opts.strict && (all.some((v) => v.severity === "error") || driftViolations.length > 0)
    );
    if (strictFailJson) process.exitCode = 1;
    await touchValidateActivity(cwd, !strictFailJson);
    return;
  }

  if (driftViolations.length) {
    console.log(chalk.bold.yellow("\n📐 Routine drift\n"));
    for (const d of driftViolations) {
      console.log(`${chalk.red("✗")} [${d.type}] ${d.message}`);
      if (d.file) console.log(chalk.gray(`   ${d.file}`));
    }
    console.log("");
  }

  console.log(chalk.bold.cyan("\n🎯 Pi validate — Sharingan + Byakugan\n"));
  for (const v of local) {
    const icon = v.severity === "error" ? "❌" : "⚠️";
    console.log(`${icon} [${v.rule}] ${path.relative(cwd, v.file)}:${v.line} — ${v.message}`);
    if (v.suggestion) console.log(chalk.gray(`   └ ${v.suggestion}`));
  }
  for (const v of semantic) {
    console.log(`${chalk.magenta("◇")} [semantic:${v.rule}] ${v.message}`);
  }
  if (merged.summary) {
    console.log(chalk.gray("\n" + merged.summary));
  }

  const violationCount = local.length + semantic.length + driftViolations.length;
  if (violationCount > 0) {
    const fileHint =
      files.length > 0
        ? ` in ${path.relative(cwd, files[0])}${files.length > 1 ? ` (+${files.length - 1} more)` : ""}`
        : "";
    try {
      const projectCfg = await readPiProjectConfig(cwd);
      const persona = getPersona(projectCfg.persona);
      const plural = violationCount > 1 ? "s" : "";
      console.log("");
      console.log(chalk.bold(`Fix plan (${violationCount} issue${plural}${fileHint}):`));
      console.log(
        formatCommandBlock(persona, [
          [`pi resonate "fix these violations"`, "Pi debates the fix and auto-loads the violations"],
          [
            `pi prompt "fix these ${violationCount} issue${plural}${fileHint}"`,
            "generate a prompt you can paste into Cursor/Claude",
          ],
        ]),
      );
      console.log(chalk.dim(`     (resonate auto-loads violations from ${PI_LAST_VALIDATE_RESULT})`));
    } catch {
      // Fall back to the simple tip if persona formatting fails for any reason.
      console.log(
        chalk.dim(
          `\nTip: pi resonate "fix these violations"  |  pi prompt "fix these ${violationCount} issue${violationCount > 1 ? "s" : ""}${fileHint}"`,
        ),
      );
      console.log(chalk.dim(`     (resonate auto-loads violations from ${PI_LAST_VALIDATE_RESULT})`));
    }
  }

  const strictFail = Boolean(
    opts.strict && (all.some((v) => v.severity === "error") || driftViolations.length > 0)
  );
  if (strictFail) process.exitCode = 1;
  await touchValidateActivity(cwd, !strictFail);
}
