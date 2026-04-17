import { cac } from "cac";
import chalk from "chalk";
import { runAuthLogin, runAuthLogout, runAuthStatus } from "./commands/auth.js";
import { runCacheClear, runCacheStats } from "./commands/cache.js";
import { runInit, parseCiProviders } from "./commands/init.js";
import { runBadge } from "./commands/badge.js";
import { runLearn } from "./commands/learn.js";
import { runRoutineNext } from "./commands/routine-next.js";
import {
  parseFormats,
  runRoutineGenerate,
  runRoutineIndexCommand,
  runRoutineList,
  runRoutineSearch,
  runRoutineShow,
  runRoutineStats,
  runRoutineUpgrade,
} from "./commands/routine.js";
import { runRoutineTemplateImport, runRoutineTemplatesList } from "./commands/template.js";
import { runPromptCompile, resolvePromptIntent } from "./commands/prompt.js";
import { runResonate, runResonateApprove } from "./commands/resonate.js";
import { runExecute, runResumeWorkflow, runResumeWorkflowById } from "./commands/execute.js";
import { runValidate } from "./commands/validate.js";
import { runDoctor } from "./commands/doctor.js";
import { runSync } from "./commands/sync.js";
import { runWatch } from "./commands/watch.js";
import { runFix } from "./commands/fix.js";
import { runTrace } from "./commands/trace.js";
import { runRemind } from "./commands/remind.js";
import { runSessionsForget, runSessionsList } from "./commands/sessions.js";
import { runTasksCommand } from "./commands/tasks.js";
import { runVcsInfo } from "./commands/vcs-cmd.js";
import { runFlow } from "./commands/flow.js";
import { PiApiClient } from "./lib/api-client.js";
import { parseOmniArgv, runOmniRouter } from "./lib/omni-router.js";

const cwd = process.cwd();

/** Known `pi <subcommand>` verbs — anything else is treated as omnirouter NL input. */
const PI_SUBCOMMANDS = new Set([
  "init",
  "learn",
  "resonate",
  "execute",
  "resume",
  "routine",
  "prompt",
  "p",
  "validate",
  "check",
  "auth-status",
  "auth-login",
  "auth-logout",
  "cache",
  "resonate-approve",
  "intent",
  "remind",
  "sync",
  "watch",
  "fix",
  "trace",
  "doctor",
  "sessions",
  "tasks",
  "vcs",
  "help",
  "version",
  "flow",
  "badge",
]);

function wrap(p: Promise<void>): void {
  p.catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}

type ValidateCliOpts = {
  json?: boolean;
  strict?: boolean;
  staged?: boolean;
  file?: string | string[];
  debugRun?: string;
  async?: boolean;
  hunksOnly?: boolean;
  routine?: string;
  autoDetectRoutine?: boolean;
  noCache?: boolean;
  force?: boolean;
  /** default | json | patches */
  format?: string;
  /** Skip implicit init / sync / learn before validate */
  noAuto?: boolean;
  skipLearn?: boolean;
  skipSync?: boolean;
  /** Fail if pi learn hasn't run (for CI/strict mode) */
  requireLearn?: boolean;
};

/** Args after first occurrence of `verb` on the command line (skips flags). */
function argvAfterVerb(verb: string): string[] {
  const argv = process.argv;
  const i = argv.indexOf(verb);
  if (i < 0) return [];
  const rest = argv.slice(i + 1);
  const out: string[] = [];
  for (let j = 0; j < rest.length; j++) {
    const a = rest[j];
    if (a.startsWith("-")) {
      if (a === "--") {
        out.push(...rest.slice(j + 1));
        break;
      }
      j++;
      continue;
    }
    out.push(a);
  }
  return out;
}

function parseValidateOutputFormat(opts: ValidateCliOpts): "default" | "json" | "patches" {
  const f = opts.format?.toLowerCase().trim();
  if (f === "patches") return "patches";
  if (f === "json") return "json";
  if (opts.json) return "json";
  return "default";
}

function runValidateCli(intent: string | undefined, opts: ValidateCliOpts): void {
  const files = opts.file ? (Array.isArray(opts.file) ? opts.file : [opts.file]) : undefined;
  wrap(
    runValidate(cwd, {
      intent,
      paths: files,
      json: opts.json,
      strict: opts.strict,
      since: opts.staged ? "staged" : "head",
      debugRun: opts.debugRun,
      async: opts.async,
      hunksOnly: opts.hunksOnly,
      routine: opts.routine,
      autoDetectRoutine: opts.autoDetectRoutine,
      noCache: Boolean(opts.noCache),
      force: Boolean(opts.force),
      outputFormat: parseValidateOutputFormat(opts),
      noAuto: Boolean(opts.noAuto),
      skipLearn: Boolean(opts.skipLearn),
      skipSync: Boolean(opts.skipSync),
      requireLearn: Boolean(opts.requireLearn),
    })
  );
}

function tryRunOmniRouterFromArgv(): boolean {
  const argv = process.argv.slice(2);
  if (!argv.length) return false;
  const firstNonFlag = argv.find((a) => !a.startsWith("-"));
  if (!firstNonFlag || firstNonFlag === "--") return false;
  if (PI_SUBCOMMANDS.has(firstNonFlag)) return false;
  const { query, forceResonate, forceRoutine } = parseOmniArgv(argv);
  if (!query) return false;
  wrap(runOmniRouter(cwd, query, { forceResonate, forceRoutine }));
  return true;
}

function main() {
  if (tryRunOmniRouterFromArgv()) return;

  const prog = cac("pi");

  prog
    .command("init", "Create .pi/ scaffold")
    .option("--with-hooks", "Install Pi git hooks (pre-commit + pre-push)")
    .option("--ci <provider>", "Generate CI: github | gitlab | circle (repeatable)", {
      type: [] as unknown as string[],
    })
    .action((opts: { withHooks?: boolean; ci?: string | string[] }) => {
      const ci = parseCiProviders(opts.ci);
      wrap(
        runInit(cwd, {
          withHooks: Boolean(opts.withHooks),
          ci: ci.length ? ci : undefined,
        })
      );
    });

  prog
    .command("learn", "Scan repo DNA → .pi/system-style.json")
    .option("--focus <dir>", "Limit scan to directory")
    .option("--with-graph", "Send redacted sample sources for import graph")
    .option("--async", "Use async workflow (202 + poll)")
    .option("--dry-run", "Print metadata JSON only; no API call")
    .option("--streaming", "Chunked ts-morph scan (auto when file count > PI_CLI_STREAMING_THRESHOLD)")
    .action(
      (opts: {
        focus?: string;
        withGraph?: boolean;
        async?: boolean;
        dryRun?: boolean;
        streaming?: boolean;
      }) => {
        wrap(
          runLearn(cwd, opts.focus, {
            withGraph: Boolean(opts.withGraph),
            async: Boolean(opts.async),
            dryRun: Boolean(opts.dryRun),
            streaming: Boolean(opts.streaming),
          })
        );
      }
    );

  prog
    .command("resonate [intent]", "Staff Engineer session — architecture thinking before you code")
    .option("--no-save", "Do not write .pi/resonance/*.md")
    .option("--with-excerpts", "Alias for --deep (redacted excerpts + deeper server context)")
    .option("--mode <mode>", "explore | challenge | decision", { default: "challenge" })
    .option("--staged", "Include git staged/working-tree diff summary")
    .option("--deep", "Deep context: excerpts + targeted file pulls + server depth")
    .option("--resume <file>", "Continue from a prior .pi/resonance/*.md transcript")
    .option("--session <id>", "Resume a local omnirouter session (see: pi sessions)")
    .option("--export", "Print a ready-to-run pi routine handoff after save")
    .option("--with-violations <file>", "JSON from pi validate --json")
    .option("--workflow", "Use Mastra workflow-backed Socratic Loop (requires PI_CLI_USE_WORKFLOWS)")
    .option("--plan", "Generate .pi-plan.md after consensus")
    .option("--no-auto", "Disable implicit `pi init` before resonate")
    .option("--require-learn", "Fail if pi learn hasn't run (for CI/strict mode)")
    .action(
      (
        intent: string | undefined,
        opts: {
          noSave?: boolean;
          withExcerpts?: boolean;
          mode?: string;
          staged?: boolean;
          deep?: boolean;
          resume?: string;
          session?: string;
          export?: boolean;
          withViolations?: string;
          workflow?: boolean;
          plan?: boolean;
          noAuto?: boolean;
          requireLearn?: boolean;
        }
      ) => {
        const full =
          argvAfterVerb("resonate").join(" ").trim() || intent?.trim() || "";
        const modeRaw = (opts.mode ?? "challenge").toLowerCase();
        const mode =
          modeRaw === "explore" || modeRaw === "challenge" || modeRaw === "decision" ? modeRaw : "challenge";
        if (!full && !opts.resume && !opts.session) {
          console.error(
            chalk.red(
              `Usage: pi resonate "<intent>" | pi resonate --resume .pi/resonance/<file>.md | pi resonate "<msg>" --session <id>`
            )
          );
          process.exitCode = 1;
          return;
        }
        if (opts.session && !full.trim()) {
          console.error(chalk.red(`Usage: pi resonate "<your reply>" --session <id>`));
          process.exitCode = 1;
          return;
        }
        wrap(
          runResonate(cwd, full, {
            noSave: Boolean(opts.noSave),
            withExcerpts: Boolean(opts.withExcerpts),
            mode,
            staged: Boolean(opts.staged),
            deep: Boolean(opts.deep),
            resume: opts.resume,
            resumeSessionId: opts.session,
            export: Boolean(opts.export),
            violationsFile: opts.withViolations,
            workflow: Boolean(opts.workflow),
            plan: Boolean(opts.plan),
            noAuto: Boolean(opts.noAuto),
            requireLearn: Boolean(opts.requireLearn),
          })
        );
      }
    );

  prog
    .command("resonate-approve <draftId>", "Approve a pending team system-style draft (tech_lead / admin key)")
    .action((draftId: string) => {
      wrap(runResonateApprove(cwd, draftId));
    });

  prog
    .command("execute [step]", "Execute a step from .pi-plan.md (generated by pi resonate --plan)")
    .action((step: string | undefined) => {
      wrap(runExecute(cwd, step));
    });

  prog
    .command("resume [runId]", "Resume a suspended resonate workflow")
    .action((runId: string | undefined) => {
      if (runId) {
        wrap(runResumeWorkflowById(cwd, runId));
      } else {
        wrap(runResumeWorkflow(cwd));
      }
    });

  prog
    .command("routine [intent]", "Pi routines — templates, index, search, generate (use: pi routine templates | import …)")
    .option("--doc <url>", "Doc URL to scrape (repeatable)", { type: [] as unknown as string[] })
    .option("--approval", "Human-in-the-loop: suspend for approval (requires server HITL + DB)")
    .option("--async", "Use async workflow (202 + poll)")
    .option("--format <list>", "Also write agent files: cursor,claude,windsurf (comma-separated)")
    .option("--with-excerpts", "Send redacted code excerpts for deeper AST context")
    .option("--list", "List saved routines")
    .option("--tags <tags>", "With --list: filter by comma-separated tags (v2 routines)")
    .option("--show <slug>", "Print a routine file by id or filename")
    .option("--upgrade <file>", "Upgrade legacy routine markdown to Pi routine v2")
    .option("--no-auto", "Disable implicit init/sync/learn before routine generate")
    .option("--skip-learn", "With auto: skip `pi learn` if system-style is missing")
    .option("--skip-sync", "With auto: skip `pi sync` before generate")
    .option("--require-learn", "Fail if pi learn hasn't run (for CI/strict mode)")
    .option("--advance", "With `pi routine next`: unlock next phase after pi check")
    .option(
      "--repo-routines",
      "With routine generate: merge routine ids scored from branch + pending files into agent injection"
    )
    .option("--inject", "With routine import: update IDE Pi block after importing template")
    .action(
      (
        intent: string | undefined,
        opts: {
          doc?: string | string[];
          approval?: boolean;
          async?: boolean;
          format?: string;
          withExcerpts?: boolean;
          list?: boolean;
          tags?: string;
          show?: string;
          upgrade?: string;
          noAuto?: boolean;
          skipLearn?: boolean;
          skipSync?: boolean;
          requireLearn?: boolean;
          advance?: boolean;
          repoRoutines?: boolean;
          inject?: boolean;
        }
      ) => {
        const verb = intent?.trim();

        if (verb === "next") {
          const rid = argvAfterVerb("next")[0];
          if (!rid) {
            console.error(chalk.red("Usage: pi routine next <routine-slug> [--advance]"));
            process.exitCode = 1;
            return;
          }
          wrap(runRoutineNext(cwd, rid, { advance: Boolean(opts.advance) }));
          return;
        }

        if (verb === "templates") {
          wrap(runRoutineTemplatesList(cwd));
          return;
        }
        if (verb === "import") {
          const target = argvAfterVerb("import")[0];
          if (!target) {
            console.error(chalk.red("Usage: pi routine import <id-or-url> [--inject]"));
            process.exitCode = 1;
            return;
          }
          wrap(runRoutineTemplateImport(cwd, target, { inject: Boolean(opts.inject) }));
          return;
        }
        if (verb === "index") {
          wrap(runRoutineIndexCommand(cwd));
          return;
        }
        if (verb === "stats") {
          wrap(runRoutineStats(cwd));
          return;
        }
        if (verb === "search") {
          const q = argvAfterVerb("search").join(" ").trim();
          if (!q) {
            console.error(chalk.red("Usage: pi routine search <query>"));
            process.exitCode = 1;
            return;
          }
          wrap(runRoutineSearch(cwd, q));
          return;
        }

        if (opts.show) {
          wrap(runRoutineShow(cwd, opts.show));
          return;
        }
        if (opts.upgrade) {
          wrap(runRoutineUpgrade(cwd, opts.upgrade));
          return;
        }
        if (verb === "show") {
          const slug = argvAfterVerb("show")[0];
          if (!slug) {
            console.error(chalk.red("Usage: pi routine show <slug>"));
            process.exitCode = 1;
            return;
          }
          wrap(runRoutineShow(cwd, slug));
          return;
        }
        if (verb === "upgrade") {
          const file = argvAfterVerb("upgrade")[0];
          if (!file) {
            console.error(chalk.red("Usage: pi routine upgrade <file>"));
            process.exitCode = 1;
            return;
          }
          wrap(runRoutineUpgrade(cwd, file));
          return;
        }

        if (opts.list || !intent || intent === "list") {
          const tags = opts.tags
            ?.split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          wrap(runRoutineList(cwd, tags?.length ? { tags } : undefined));
          return;
        }

        const docs = opts.doc ? (Array.isArray(opts.doc) ? opts.doc : [opts.doc]) : [];
        const formats = parseFormats(opts.format);
        wrap(
          runRoutineGenerate(cwd, intent, docs, {
            approval: opts.approval,
            async: opts.async,
            format: formats,
            withExcerpts: opts.withExcerpts,
            noAuto: Boolean(opts.noAuto),
            skipLearn: Boolean(opts.skipLearn),
            skipSync: Boolean(opts.skipSync),
            requireLearn: Boolean(opts.requireLearn),
            repoRoutines: Boolean(opts.repoRoutines),
          })
        );
      }
    );

  const runPromptCli = (
    intent: string | undefined,
    argvVerb: string,
    opts: { raw?: boolean; noCopy?: boolean; withExcerpts?: boolean; noAuto?: boolean; skipLearn?: boolean; skipSync?: boolean }
  ): void => {
    const full = resolvePromptIntent(intent, argvAfterVerb(argvVerb));
    if (!full) {
      console.error(chalk.red(`Usage: pi ${argvVerb} "<your vague intent>"`));
      process.exitCode = 1;
      return;
    }
    wrap(
      runPromptCompile(cwd, full, {
        raw: Boolean(opts.raw),
        noCopy: Boolean(opts.noCopy),
        withExcerpts: Boolean(opts.withExcerpts),
        noAuto: Boolean(opts.noAuto),
        skipLearn: Boolean(opts.skipLearn),
        skipSync: Boolean(opts.skipSync),
      })
    );
  };

  prog
    .command("prompt [intent]", "Compile a codebase-aware prompt for Cursor / Claude / Windsurf")
    .option("--raw", "Print prompt text only (pipe-friendly)")
    .option("--no-copy", "Skip clipboard copy")
    .option("--with-excerpts", "Send redacted code excerpts for deeper AST context")
    .option("--no-auto", "Disable implicit init/sync/learn before prompt")
    .option("--skip-learn", "With auto: skip `pi learn`")
    .option("--skip-sync", "With auto: skip `pi sync`")
    .action(
      (intent: string | undefined, opts: { raw?: boolean; noCopy?: boolean; withExcerpts?: boolean; noAuto?: boolean; skipLearn?: boolean; skipSync?: boolean }) => {
      runPromptCli(intent, "prompt", opts);
    }
    );

  prog
    .command("p [intent]", "Alias: compile a prompt (shorthand for pi prompt)")
    .option("--raw", "Print prompt text only (pipe-friendly)")
    .option("--no-copy", "Skip clipboard copy")
    .option("--with-excerpts", "Send redacted code excerpts for deeper AST context")
    .option("--no-auto", "Disable implicit init/sync/learn before prompt")
    .option("--skip-learn", "With auto: skip `pi learn`")
    .option("--skip-sync", "With auto: skip `pi sync`")
    .action(
      (intent: string | undefined, opts: { raw?: boolean; noCopy?: boolean; withExcerpts?: boolean; noAuto?: boolean; skipLearn?: boolean; skipSync?: boolean }) => {
      runPromptCli(intent, "p", opts);
    }
    );

  prog
    .command("validate [intent]", "Validate changed files + optional routine")
    .option("--json", "JSON output")
    .option("--strict", "Fail on errors")
    .option("--staged", "Use working tree / staged files")
    .option("--file <path>", "Validate specific file (repeatable)", { type: [] as unknown as string[] })
    .option("--debug-run <runId>", "Print Mastra workflow snapshot for a run (audit / time travel)")
    .option("--async", "Use async workflow (202 + poll)")
    .option("--hunks-only", "Send only git diff hunks as excerpts")
    .option("--routine <id>", "Check drift vs this routine id under .pi/routines/")
    .option("--auto-detect-routine", "Infer routine id from branch name or last commit message")
    .option("--no-auto", "Disable implicit init/sync/learn before validate")
    .option("--skip-learn", "With auto: skip `pi learn` if system-style is missing")
    .option("--skip-sync", "With auto: skip `pi sync`")
    .option("--require-learn", "Fail if pi learn hasn't run (for CI/strict mode)")
    .option("--no-cache", "Bypass Rasengan cloud validate cache (always call API)")
    .option("--force", "Bypass hourly validate API budget guard (PI_CLI_MAX_API_CALLS_PER_HOUR)")
    .option("--format <fmt>", "Output: default | json | patches (machine-readable local patches)")
    .action((intent: string | undefined, opts: ValidateCliOpts) => {
      runValidateCli(intent, opts);
    });

  prog
    .command("check [intent]", "Alias for pi validate")
    .option("--json", "JSON output")
    .option("--strict", "Fail on errors")
    .option("--staged", "Use working tree / staged files")
    .option("--file <path>", "Validate specific file (repeatable)", { type: [] as unknown as string[] })
    .option("--debug-run <runId>", "Print Mastra workflow snapshot for a run (audit / time travel)")
    .option("--async", "Use async workflow (202 + poll)")
    .option("--hunks-only", "Send only git diff hunks as excerpts")
    .option("--routine <id>", "Check drift vs this routine id under .pi/routines/")
    .option("--auto-detect-routine", "Infer routine id from branch name or last commit message")
    .option("--no-auto", "Disable implicit init/sync/learn before validate")
    .option("--skip-learn", "With auto: skip `pi learn` if system-style is missing")
    .option("--skip-sync", "With auto: skip `pi sync`")
    .option("--require-learn", "Fail if pi learn hasn't run (for CI/strict mode)")
    .option("--no-cache", "Bypass Rasengan cloud validate cache (always call API)")
    .option("--force", "Bypass hourly validate API budget guard (PI_CLI_MAX_API_CALLS_PER_HOUR)")
    .option("--format <fmt>", "Output: default | json | patches (machine-readable local patches)")
    .action((intent: string | undefined, opts: ValidateCliOpts) => {
      runValidateCli(intent, opts);
    });

  prog.command("auth-status", "Show authentication status").action(() => {
    wrap(runAuthStatus());
  });

  prog
    .command("auth-login", "Save API key to global config")
    .option("--api-key <key>", "Pi API key")
    .option("--base-url <url>", "Pi API base URL")
    .action((opts: { apiKey?: string; baseUrl?: string }) => {
      if (!opts.apiKey) {
        console.error(chalk.red("Missing --api-key"));
        process.exitCode = 1;
        return;
      }
      wrap(runAuthLogin(opts.apiKey, opts.baseUrl));
    });

  prog.command("auth-logout", "Clear global Pi CLI credentials").action(() => {
    wrap(runAuthLogout());
  });

  prog.command("cache <action>", "Rasengan cache + budget stats").action((action: string) => {
    if (action === "clear") wrap(runCacheClear(cwd, "all"));
    else if (action === "stats") wrap(runCacheStats(cwd));
    else console.log("Usage: pi cache clear | pi cache stats");
  });

  prog.command("intent <query>", "Byakugan — print intent DSL (debug)").action((query: string) => {
    wrap(
      (async () => {
        const client = new PiApiClient();
        const data = await client.intent({ query, changed_files: [], project_context: {} });
        console.log(JSON.stringify(data, null, 2));
      })()
    );
  });

  prog
    .command("remind <query>", "Smart router — multilingual NL → suggested `pi` command plan (@clack/prompts)")
    .option("--exec", "Execute the planned commands (with confirmation)")
    .action((query: string, opts: { exec?: boolean }) => {
      const full = argvAfterVerb("remind").join(" ").trim() || query?.trim() || "";
      if (!full) {
        console.error(chalk.red(`Usage: pi remind "<natural language>"`));
        process.exitCode = 1;
        return;
      }
      wrap(runRemind(cwd, full, { exec: Boolean(opts.exec) }));
    });

  prog
    .command("sync", "Pull latest team artifacts from R2 → .pi/")
    .option("--no-graph", "Skip downloading latest dependency graph JSON")
    .action((opts: { noGraph?: boolean }) => {
      wrap(runSync(cwd, { includeGraph: !Boolean(opts.noGraph) }));
    });

  prog
    .command("watch", "Realtime deterministic governance on file changes (chokidar)")
    .option("--no-auto", "Disable implicit `pi init` before watch")
    .option("--daemon", "Run watch in the background (.pi/.watch-pid.json, .pi/logs/watch.log)")
    .option("--foreground", "Terminal watch + log/heartbeat (no detach); with --daemon, run daemon in this shell")
    .option("--stop", "Stop background Pi watch")
    .option("--status", "Show Pi watch daemon status (uses heartbeat, not only PID)")
    .option(
      "--suggest-routines",
      "Log top routine ids matched from branch + changed files (throttled; see .pi/logs/watch.log)"
    )
    .action(
      (opts: {
        noAuto?: boolean;
        daemon?: boolean;
        foreground?: boolean;
        stop?: boolean;
        status?: boolean;
        suggestRoutines?: boolean;
      }) => {
        wrap(
          runWatch(cwd, {
            noAuto: Boolean(opts.noAuto),
            daemon: Boolean(opts.daemon),
            foreground: Boolean(opts.foreground),
            stop: Boolean(opts.stop),
            status: Boolean(opts.status),
            suggestRoutines: Boolean(opts.suggestRoutines),
          })
        );
      }
    );

  prog
    .command("fix", "Deterministic autofixes for local Sharingan violations (ts-morph)")
    .option("--staged", "Use working tree / staged files")
    .option("--dry-run", "Print what would change without saving")
    .option("--no-auto", "Disable implicit `pi init` before fix")
    .option("--interactive", "Prompt before applying fixes to each file")
    .option("--confidence-threshold <n>", "Only apply fixes with patch confidence >= n (0–1)", {
      default: "0",
    })
    .action(
      (opts: {
        staged?: boolean;
        dryRun?: boolean;
        noAuto?: boolean;
        interactive?: boolean;
        confidenceThreshold?: string;
      }) => {
        const t = Number(opts.confidenceThreshold ?? 0);
        wrap(
          runFix(cwd, {
            since: opts.staged ? "staged" : "head",
            dryRun: Boolean(opts.dryRun),
            noAuto: Boolean(opts.noAuto),
            interactive: Boolean(opts.interactive),
            confidenceThreshold: Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0,
          })
        );
      }
    );

  prog
    .command("trace <runId>", "Observability — workflow snapshot + debug links")
    .option(
      "--workflow <key>",
      "cliValidateWorkflow | cliRoutineWorkflow | cliLearnWorkflow | cliResonateWorkflow",
      { default: "cliValidateWorkflow" }
    )
    .action((runId: string | undefined, opts: { workflow?: string }) => {
      if (!runId) {
        console.error(chalk.red("Usage: pi trace <runId>"));
        process.exitCode = 1;
        return;
      }
      const wf = opts.workflow;
      const workflowKey =
        wf === "cliRoutineWorkflow" || wf === "cliLearnWorkflow" || wf === "cliResonateWorkflow" || wf === "cliValidateWorkflow"
          ? wf
          : "cliValidateWorkflow";
      wrap(runTrace(runId, { workflowKey }));
    });

  prog
    .command("doctor", "Comprehensive Pi readiness check — auth, context, languages, health")
    .option("--demo", "Run a quick local AST boundary check (no API call)")
    .option("--verbose", "Include detailed language breakdown")
    .option("--fix", "Auto-run remediation commands (init, learn, sync) for detected issues")
    .action((opts: { demo?: boolean; verbose?: boolean; fix?: boolean }) => {
      wrap(runDoctor(cwd, { demo: Boolean(opts.demo), verbose: Boolean(opts.verbose), fix: Boolean(opts.fix) }));
    });

  prog
    .command("badge", "Add or refresh the Pi badge in README.md")
    .option("--dry-run", "Print badge markdown only (no file write)")
    .option("--copy", "Copy badge markdown to clipboard")
    .option("--dynamic-url <url>", "Image URL for a dynamic badge instead of the default shields link")
    .action((opts: { dryRun?: boolean; copy?: boolean; dynamicUrl?: string }) => {
      wrap(
        runBadge(cwd, {
          dryRun: Boolean(opts.dryRun),
          copy: Boolean(opts.copy),
          dynamicUrl: opts.dynamicUrl,
        })
      );
    });

  prog
    .command("tasks [action] [id]", "Agent task tracking — list, show, tree, clean, resume")
    .action((action?: string, id?: string) => {
      wrap(runTasksCommand(cwd, action, id));
    });

  prog.command("vcs", "Show VCS detection and adapter capabilities").action(() => {
    wrap(runVcsInfo(cwd));
  });

  prog
    .command("sessions [action] [sessionId]", "List or forget omnirouter / resonate sessions (this repo path)")
    .action((action?: string, sessionId?: string) => {
      const act = (action ?? "list").toLowerCase();
      if (act === "list" || act === "ls") {
        wrap(runSessionsList(cwd));
        return;
      }
      if (act === "forget" || act === "rm" || act === "delete") {
        if (!sessionId?.trim()) {
          console.error(chalk.red("Usage: pi sessions forget <session_id>"));
          process.exitCode = 1;
          return;
        }
        wrap(runSessionsForget(cwd, sessionId.trim()));
        return;
      }
      console.error(chalk.red("Unknown action. Use: pi sessions | pi sessions forget <session_id>"));
      process.exitCode = 1;
    });

  prog
    .command("flow [name]", "Run named command pipelines — setup, check-and-fix, full-check")
    .action((name?: string) => {
      wrap(runFlow(cwd, name));
    });

  // Custom help header
  const originalHelp = prog.outputHelp.bind(prog);
  prog.outputHelp = () => {
    console.log(chalk.bold.cyan("\n  Pi — Your Staff Engineer on the Terminal"));
    console.log(chalk.dim("  Intelligence infrastructure for AI agents\n"));
    console.log(chalk.bold("  Quick Start:"));
    console.log(chalk.cyan('    pi "add billing with Stripe"  ') + chalk.dim("# Natural language - just talk to Pi"));
    console.log(chalk.cyan("    pi learn                      ") + chalk.dim("# Scan your codebase first"));
    console.log(chalk.cyan("    pi resonate \"<intent>\"        ") + chalk.dim("# Architectural discussion"));
    console.log("");
    originalHelp();
  };
  
  prog.help();
  prog.version("0.1.0");
  prog.parse(process.argv);
}

main();
