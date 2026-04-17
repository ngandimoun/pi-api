import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";

import { getApiKey, getBaseUrl } from "../lib/config.js";
import { PiApiClient, type PiCliHealthReport } from "../lib/api-client.js";
import {
  PI_CONSTITUTION_FILE,
  PI_DIR,
  PI_HANDOFF_FILE,
  PI_ROUTINES_DIR,
  SYSTEM_STYLE_FILE,
} from "../lib/constants.js";
import { checkArchitecturalBoundaries } from "../lib/ast/sharingan.js";
import { checkContextHealth } from "../lib/context-health.js";
import {
  collectPolyglotHints,
  collectPolyglotHintsEnhanced,
  summarizePolyglotHints,
  summarizeEnhancedPolyglotHints,
} from "../lib/polyglot-hints.js";
import { needsLearnCheck } from "../lib/dependency-chain.js";
import { verifyDependencyUsage } from "../lib/routine-repo-context.js";
import { findGitRoot, PI_HOOK_MARKER_BEGIN } from "../lib/git-hooks-installer.js";
import { detectExistingPiCi } from "../lib/ci-generator.js";
import { readCliActivity, daysSince } from "../lib/cli-activity.js";
import { getWatchDaemonStatus } from "./watch.js";
import { getRepoContextRoutineRankings } from "../lib/routine-context-detector.js";
import { getCurrentBranch, getPendingChanges } from "../lib/vcs/index.js";

export type DoctorOpts = {
  /** Run a quick local AST boundary demo (no API) */
  demo?: boolean;
  /** Include verbose polyglot analysis */
  verbose?: boolean;
  /** Auto-fix detected issues (init, learn, sync) */
  fix?: boolean;
};

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function describePiGitHooks(cwd: string): Promise<string> {
  const root = await findGitRoot(cwd);
  if (!root) return chalk.dim("no Git repo — skipped");
  const candidates = [
    path.join(root, ".husky", "pre-commit"),
    path.join(root, ".git", "hooks", "pre-commit"),
  ];
  for (const c of candidates) {
    try {
      const t = await fs.readFile(c, "utf8");
      if (t.includes(PI_HOOK_MARKER_BEGIN) || /\bpi\s+validate\b/.test(t)) {
        return chalk.green(`✓ ${path.relative(cwd, c)}`);
      }
    } catch {
      /* next */
    }
  }
  const lf = path.join(root, "lefthook-local.yml");
  try {
    const t = await fs.readFile(lf, "utf8");
    if (t.includes("pi-validate:")) return chalk.green(`✓ lefthook-local.yml`);
  } catch {
    /* none */
  }
  return chalk.yellow("Pi hooks not detected — run pi init --with-hooks or pi-hokage");
}

async function getFileAge(p: string): Promise<{ exists: boolean; ageMs?: number; ageDays?: number }> {
  try {
    const stats = await fs.stat(p);
    const ageMs = Date.now() - stats.mtimeMs;
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    return { exists: true, ageMs, ageDays };
  } catch {
    return { exists: false };
  }
}

async function checkApiReachable(baseUrl: string, hasKey: boolean): Promise<{ reachable: boolean; error?: string }> {
  if (!hasKey) return { reachable: false, error: "no API key" };
  try {
    const client = new PiApiClient();
    const result = await client.verify();
    return { reachable: result.valid };
  } catch (e) {
    return { reachable: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}

/**
 * Server readiness snapshot from `GET /api/cli/health`.
 * Returns null when the backend doesn't expose the route (older deploy).
 */
async function fetchServerHealth(): Promise<PiCliHealthReport | null> {
  try {
    const client = new PiApiClient();
    return await client.health();
  } catch {
    return null;
  }
}

function renderServerHealthBlock(health: PiCliHealthReport): void {
  const line = (label: string, ok: boolean, detail?: string) => {
    const head = ok ? chalk.green(`  ✓ ${label}`) : chalk.yellow(`  ✗ ${label}`);
    console.log(detail ? `${head}  ${chalk.dim(detail)}` : head);
  };

  console.log(chalk.bold("\nServer readiness  (Pi CLI Hokage / Mastra)"));
  const c = health.checks;
  line(
    "Default model",
    c.default_model.configured,
    c.default_model.configured ? "PI_MASTRA_DEFAULT_MODEL set" : "PI_MASTRA_DEFAULT_MODEL missing",
  );
  const pgDiag = c.postgres.diagnostics;
  const postgresDetail = (() => {
    if (c.postgres.configured) {
      return c.postgres.reachable
        ? "reachable"
        : `unreachable${c.postgres.error ? ` — ${c.postgres.error}` : ""}`;
    }
    if (pgDiag?.deferred_during_next_build) return "deferred during Next build (unexpected in prod)";
    if (!pgDiag?.env_value_present) return "no PI_CLI_DATABASE_URL or DATABASE_URL on this Vercel env";
    const src = pgDiag.env_source ? ` (${pgDiag.env_source})` : "";
    const f = pgDiag.flags;
    if (!pgDiag.normalized_ok && f) {
      if (!f.trimmed_nonempty)
        return `empty after trim/sanitize${src} — re-paste the connection string in Vercel`;
      if (f.angle_template) return `angle-bracket placeholder not replaced${src}`;
      if (f.has_placeholder) return `still contains [YOUR-PASSWORD] or <DB_PASSWORD>${src}`;
      if (!f.scheme_ok)
        return `does not start with postgres:// — remove "export VAR=" prefix or stray quotes${src}`;
      if (!f.length_ok) return `looks truncated (<24 chars)${src}`;
      if (f.hostname_is_base) return `literal "base" hostname (unfilled template)${src}`;
      if (!f.whatwg_url_ok && !f.pg_parse_ok && !f.regex_fallback_ok)
        return `unparseable — percent-encode @ : / ? # [ ] % in the password${src}`;
      return `URL failed validation${src}`;
    }
    if (!pgDiag.normalized_ok) return `URL failed validation (placeholder, too short, or malformed)${src}`;
    if (!pgDiag.canonical_parse_ok) return "URL did not parse for Postgres (encode special chars in password)";
    if (pgDiag.store_init_error)
      return `store init: ${pgDiag.store_init_error}`;
    return "store not created — check Vercel logs for [mastra-storage]";
  })();
  line("Postgres (Mastra schema)", c.postgres.reachable && c.postgres.configured, postgresDetail);
  line(
    "Workflow mode",
    c.workflow_mode.enabled,
    c.workflow_mode.enabled ? "PI_CLI_USE_WORKFLOWS=true" : "disabled",
  );
  line(
    "Routine HITL",
    c.routine_hitl.enabled,
    c.routine_hitl.enabled ? "suspend/resume available" : "PI_CLI_ROUTINE_HITL off",
  );
  line(
    "Memory",
    c.memory.enabled,
    c.memory.semantic_recall
      ? "semantic recall on"
      : c.memory.enabled
        ? "thread history only"
        : "PI_CLI_ENABLE_MEMORY off / no Postgres",
  );
  line("Trigger.dev", c.trigger_dev.configured, c.trigger_dev.configured ? "async workflows" : "no TRIGGER_SECRET_KEY");
  line("Gemini", c.gemini.configured, c.gemini.configured ? "GOOGLE_GENERATIVE_AI_API_KEY set" : "missing");
  console.log(
    `  ${chalk.dim("·")} Fail-closed:    ${
      c.fail_closed.enabled ? chalk.green("on (strict)") : chalk.yellow("off (silent fallback)")
    }`,
  );
  console.log(
    `  ${chalk.dim("·")} Workflows:      ${chalk.cyan(String(health.workflows.length))}  agents: ${chalk.cyan(String(health.agents.length))}`,
  );
  console.log(
    `  ${chalk.dim("·")} Overall:        ${health.ok ? chalk.green("production-ready") : chalk.yellow("degraded — see flags above")}`,
  );
}

async function analyzeSystemStyle(cwd: string): Promise<{
  exists: boolean;
  isStub: boolean;
  ageMs?: number;
  ageDays?: number;
  fieldCount?: number;
  hasGraph?: boolean;
}> {
  const stylePath = path.join(cwd, SYSTEM_STYLE_FILE);
  const fileInfo = await getFileAge(stylePath);
  if (!fileInfo.exists) {
    return { exists: false, isStub: false };
  }

  try {
    const content = await fs.readFile(stylePath, "utf8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const isStub = typeof parsed.note === "string" && parsed.note.includes("Run `pi learn`");
    const fieldCount = Object.keys(parsed).length;
    const hasGraph = Boolean(parsed.graph_job_triggered || parsed.import_graph);
    return {
      exists: true,
      isStub,
      ageMs: fileInfo.ageMs,
      ageDays: fileInfo.ageDays,
      fieldCount,
      hasGraph,
    };
  } catch {
    return { exists: true, isStub: false, ageMs: fileInfo.ageMs, ageDays: fileInfo.ageDays };
  }
}

async function countRoutines(cwd: string): Promise<number> {
  const routinesDir = path.join(cwd, PI_ROUTINES_DIR);
  try {
    const files = await fs.readdir(routinesDir);
    return files.filter((f) => f.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

function formatStatus(ok: boolean, okMsg: string, failMsg: string): string {
  return ok ? chalk.green(`✓ ${okMsg}`) : chalk.yellow(`⚠ ${failMsg}`);
}

function formatCheck(ok: boolean, label: string): string {
  return ok ? chalk.green(`✓ ${label}`) : chalk.yellow(`✗ ${label}`);
}

async function findDemoSourceFile(cwd: string): Promise<{ path: string; content: string } | null> {
  const candidates = [
    "app/layout.tsx",
    "app/layout.jsx",
    "src/app/layout.tsx",
    "src/app/layout.jsx",
    "pages/_app.tsx",
    "pages/_app.jsx",
    "src/main.ts",
    "src/main.tsx",
    "src/index.ts",
    "src/index.tsx",
    "main.py",
    "app.py",
    "main.go",
    "Cargo.toml",
  ];
  for (const rel of candidates) {
    const abs = path.join(cwd, rel);
    try {
      const content = await fs.readFile(abs, "utf8");
      return { path: rel, content };
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * Comprehensive health check for Pi CLI readiness.
 */
export async function runDoctor(cwd: string, opts?: DoctorOpts): Promise<void> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey() ?? process.env.PI_API_KEY?.trim();
  const hasKey = Boolean(apiKey);

  console.log(chalk.bold.cyan("\n  Pi Doctor — Readiness Check\n"));

  let score = 0;
  const maxScore = 12;

  console.log(chalk.bold("Authentication"));
  console.log(`  Base URL       ${chalk.cyan(baseUrl)}`);
  console.log(`  API key        ${formatStatus(hasKey, "configured", "missing — run pi-hokage")}`);
  if (hasKey) score += 2;

  const apiCheck = await checkApiReachable(baseUrl, hasKey);
  console.log(`  API reachable  ${formatStatus(apiCheck.reachable, "yes", apiCheck.error ?? "no")}`);
  if (apiCheck.reachable) score += 1;

  let serverHealth: PiCliHealthReport | null = null;
  if (apiCheck.reachable) {
    serverHealth = await fetchServerHealth();
    if (serverHealth) {
      renderServerHealthBlock(serverHealth);
      if (serverHealth.ok) score += 2;
    }
  }

  console.log(chalk.bold("\nProject Structure"));
  const piDirExists = await pathExists(path.join(cwd, PI_DIR));
  console.log(`  ${PI_DIR}/               ${formatStatus(piDirExists, "initialized", "missing — run pi init")}`);
  if (piDirExists) score += 1;

  const styleAnalysis = await analyzeSystemStyle(cwd);
  const { needsLearn, reason } = await needsLearnCheck(cwd);
  
  if (!styleAnalysis.exists) {
    console.log(`  system-style.json  ${chalk.yellow("✗ not found — run pi learn")}`);
  } else if (styleAnalysis.isStub) {
    console.log(`  system-style.json  ${chalk.yellow("✗ stub only — run pi learn")}`);
  } else {
    const ageStr = styleAnalysis.ageDays !== undefined ? `${styleAnalysis.ageDays}d old` : "";
    const isStale = styleAnalysis.ageDays !== undefined && styleAnalysis.ageDays > 7;
    console.log(
      `  system-style.json  ${formatStatus(!isStale, `present (${ageStr})`, `stale (${ageStr}) — run pi learn`)}`
    );
    if (!isStale) score += 2;
  }

  const constitutionExists = await pathExists(path.join(cwd, PI_CONSTITUTION_FILE));
  console.log(`  constitution.md    ${formatStatus(constitutionExists, "present", "optional")}`);
  
  const graphExists = await pathExists(path.join(cwd, ".pi/graph-latest.json"));
  const hasServerGraph = styleAnalysis.hasGraph;
  console.log(
    `  Import graph       ${formatStatus(graphExists || Boolean(hasServerGraph), "available", "not built — run pi learn --with-graph")}`
  );
  if (graphExists || hasServerGraph) score += 1;

  const routineCount = await countRoutines(cwd);
  console.log(`  Routines           ${routineCount > 0 ? chalk.green(`✓ ${routineCount} saved`) : chalk.dim("0 — run pi routine")}`);

  console.log(chalk.bold("\nRoutine hints (repo context)"));
  try {
    const branch = (await getCurrentBranch(cwd)) ?? "(no branch)";
    const changed = await getPendingChanges(cwd);
    const ranked = await getRepoContextRoutineRankings(cwd);
    console.log(chalk.dim(`  Branch: ${branch} · pending files: ${changed.length}`));
    if (ranked.length) {
      for (const { id, score } of ranked) {
        console.log(`  ${chalk.cyan(id)}  ${chalk.dim(`score ${score}`)}`);
      }
      console.log(
        chalk.dim("  Tip: pi routine generate \"…\" --repo-routines  ·  pi watch --suggest-routines")
      );
    } else {
      console.log(chalk.dim("  No index entries scored from branch + pending paths (build index: pi routine index)."));
    }
  } catch {
    console.log(chalk.dim("  (skipped — no git / routine index)"));
  }

  console.log(chalk.bold("\nAutomation"));
  console.log(`  Git hooks (Pi)    ${await describePiGitHooks(cwd)}`);
  const ciHits = await detectExistingPiCi(cwd);
  console.log(
    `  CI (Pi)           ${
      ciHits.length
        ? chalk.green(`✓ ${ciHits.map((h) => path.relative(cwd, h)).join(", ")}`)
        : chalk.dim("none — pi init --ci github")
    }`
  );
  const watchSt = await getWatchDaemonStatus(cwd);
  if (watchSt.running && watchSt.pid && watchSt.healthy !== false) {
    console.log(`  Pi watch daemon   ${chalk.green(`running (pid ${watchSt.pid})`)}`);
    if (watchSt.lastTick) console.log(chalk.dim(`                      heartbeat: ${watchSt.lastTick}`));
    if (watchSt.logPath) console.log(chalk.dim(`                      log: ${path.relative(cwd, watchSt.logPath)}`));
  } else if (watchSt.staleHeartbeat) {
    console.log(`  Pi watch daemon   ${chalk.yellow(`heartbeat stale (pid ${watchSt.pid})`)}`);
    if (watchSt.logPath) console.log(chalk.dim(`                      log: ${path.relative(cwd, watchSt.logPath)}`));
  } else if (watchSt.staleFile) {
    console.log(`  Pi watch daemon   ${chalk.yellow("stale metadata — pi watch --stop")}`);
  } else {
    console.log(`  Pi watch daemon   ${chalk.dim("not running — pi watch --daemon")}`);
  }

  console.log(chalk.bold("\nLocal habits"));
  const act = await readCliActivity(cwd);
  const dv = daysSince(act.last_validate_at);
  const pv = daysSince(act.last_prompt_at);
  if (act.last_validate_at) {
    const failed = act.last_validate_ok === false;
    const failedHint = failed ? chalk.yellow(" (failed — fix and re-run pi validate)") : "";
    const staleHint =
      dv !== null && dv > 7
        ? chalk.yellow(failed ? ` · ${dv}d ago` : ` · ${dv}d ago — run pi validate before PR`)
        : "";
    console.log(`  Last pi validate  ${chalk.cyan(act.last_validate_at.slice(0, 19))}${failedHint}${staleHint}`);
  } else {
    console.log(`  Last pi validate  ${chalk.dim("not yet — pi validate")}`);
  }
  if (act.last_prompt_at) {
    const nudgeP = pv !== null && pv > 5 ? chalk.yellow(` (${pv}d since pi p)`) : chalk.dim("");
    console.log(`  Last pi prompt    ${chalk.cyan(act.last_prompt_at.slice(0, 19))}${nudgeP}`);
  } else {
    console.log(`  Last pi prompt    ${chalk.dim("not yet — pi p \"…\"")}`);
  }
  console.log(chalk.dim("  Stored in .pi/.cli-activity.json (local only)."));

  console.log(chalk.bold("\nCodebase Analysis"));

  const polyglotEnhanced = opts?.verbose ? await collectPolyglotHintsEnhanced(cwd) : null;
  const polyglot = polyglotEnhanced ?? (await collectPolyglotHints(cwd));
  const totalFiles = Object.values(polyglot.counts_by_extension).reduce((a, b) => a + b, 0);
  
  const langSummary = polyglotEnhanced 
    ? summarizeEnhancedPolyglotHints(polyglotEnhanced)
    : summarizePolyglotHints(polyglot);
  console.log(`  Languages          ${totalFiles > 0 ? chalk.cyan(langSummary) : chalk.dim("(no files found)")}`);
  if (totalFiles > 0) score += 1;

  const sortedExts = Object.entries(polyglot.counts_by_extension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (opts?.verbose && sortedExts.length > 0) {
    const total = sortedExts.reduce((acc, [, n]) => acc + n, 0);
    for (const [ext, count] of sortedExts) {
      const pct = Math.round((count / total) * 100);
      console.log(chalk.dim(`                     ${ext}: ${count} files (${pct}%)`));
    }
  }

  if (opts?.verbose && polyglotEnhanced) {
    if (polyglotEnhanced.python?.detected) {
      const py = polyglotEnhanced.python;
      const depCount = py.requirements.length + py.pyproject_deps.length;
      const importCount = Object.keys(py.import_histogram).length;
      console.log(chalk.bold("\n  Python Analysis"));
      console.log(`    Dependencies     ${chalk.cyan(String(depCount))} declared`);
      console.log(`    Unique imports   ${chalk.cyan(String(importCount))} found`);
      if (py.frameworks.length > 0) {
        console.log(`    Frameworks       ${chalk.cyan(py.frameworks.join(", "))}`);
      }
    }

    if (polyglotEnhanced.go?.detected) {
      const go = polyglotEnhanced.go;
      console.log(chalk.bold("\n  Go Analysis"));
      if (go.module_name) {
        console.log(`    Module           ${chalk.cyan(go.module_name)}`);
      }
      if (go.go_version) {
        console.log(`    Go version       ${chalk.cyan(go.go_version)}`);
      }
      console.log(`    Dependencies     ${chalk.cyan(String(go.dependencies.length))}`);
    }

    if (polyglotEnhanced.rust?.detected) {
      const rust = polyglotEnhanced.rust;
      console.log(chalk.bold("\n  Rust Analysis"));
      if (rust.crate_name) {
        console.log(`    Crate            ${chalk.cyan(rust.crate_name)}`);
      }
      if (rust.edition) {
        console.log(`    Edition          ${chalk.cyan(rust.edition)}`);
      }
      console.log(`    Dependencies     ${chalk.cyan(String(rust.dependencies.length))}`);
    }
  }

  const hasPackageJson = await pathExists(path.join(cwd, "package.json"));
  const hasPyProject = await pathExists(path.join(cwd, "pyproject.toml"));
  const hasRequirements = await pathExists(path.join(cwd, "requirements.txt"));
  const hasGoMod = await pathExists(path.join(cwd, "go.mod"));
  const hasCargoToml = await pathExists(path.join(cwd, "Cargo.toml"));

  const depManagers: string[] = [];
  if (hasPackageJson) depManagers.push("npm/yarn");
  if (hasPyProject) depManagers.push("pyproject");
  if (hasRequirements) depManagers.push("pip");
  if (hasGoMod) depManagers.push("go.mod");
  if (hasCargoToml) depManagers.push("cargo");

  console.log(
    `  Package managers   ${depManagers.length > 0 ? chalk.cyan(depManagers.join(", ")) : chalk.dim("none detected")}`
  );

  if (opts?.verbose && hasPackageJson) {
    console.log(chalk.bold("\nDependency Verification (JS/TS)"));
    const depVerify = await verifyDependencyUsage(cwd);
    const verifiedCount = Object.keys(depVerify.verified_in_use).length;
    const unusedCount = depVerify.declared_but_unused.length;
    const undeclaredCount = depVerify.used_but_not_declared.length;

    console.log(`  Declared deps      ${chalk.cyan(String(depVerify.total_declared))}`);
    console.log(`  Verified in use    ${chalk.green(String(verifiedCount))}`);
    
    if (unusedCount > 0) {
      console.log(`  Declared unused    ${chalk.yellow(String(unusedCount))}`);
      const toShow = depVerify.declared_but_unused.slice(0, 5);
      for (const pkg of toShow) {
        console.log(chalk.dim(`                     • ${pkg}`));
      }
      if (unusedCount > 5) {
        console.log(chalk.dim(`                     ... and ${unusedCount - 5} more`));
      }
    } else {
      console.log(`  Declared unused    ${chalk.green("0")}`);
    }

    if (undeclaredCount > 0) {
      console.log(`  Used undeclared    ${chalk.yellow(String(undeclaredCount))}`);
      const toShow = depVerify.used_but_not_declared.slice(0, 5);
      for (const pkg of toShow) {
        console.log(chalk.dim(`                     • ${pkg}`));
      }
      if (undeclaredCount > 5) {
        console.log(chalk.dim(`                     ... and ${undeclaredCount - 5} more`));
      }
    } else {
      console.log(`  Used undeclared    ${chalk.green("0")}`);
    }
  }

  console.log(chalk.bold("\nContext Health"));
  const health = await checkContextHealth(cwd);
  if (health.isStale) {
    for (const reason of health.reasons) {
      console.log(chalk.yellow(`  ⚠ ${reason}`));
    }
  } else {
    console.log(chalk.green("  ✓ Context is fresh"));
    score += 2;
  }

  const readinessPercent = Math.round((score / maxScore) * 100);
  const readinessColor =
    readinessPercent >= 80 ? chalk.green : readinessPercent >= 50 ? chalk.yellow : chalk.red;

  console.log(chalk.bold("\nReadiness Score"));
  console.log(`  ${readinessColor(`${readinessPercent}%`)} (${score}/${maxScore})`);

  if (readinessPercent < 100) {
    console.log(chalk.bold("\nSuggested Actions"));
    
    const actionsTaken: string[] = [];
    
    // Auto-fix if --fix flag is set
    if (opts?.fix) {
      console.log(chalk.cyan("\n  Auto-fixing detected issues...\n"));
      
      // Can't auto-fix API key (requires user input)
      if (!hasKey) {
        console.log(chalk.yellow("  • Cannot auto-fix: API key missing — run pi-hokage manually"));
      } else if (!apiCheck.reachable) {
        console.log(chalk.yellow("  • Cannot auto-fix: API unreachable — check PI_CLI_BASE_URL and network"));
      }
      
      // Auto-run pi init
      if (!piDirExists) {
        try {
          const { runInit } = await import("./init.js");
          console.log(chalk.dim("  ◐ Running pi init..."));
          await runInit(cwd);
          actionsTaken.push("initialized .pi/");
        } catch (e) {
          console.log(chalk.red(`  ✗ Failed to run pi init: ${e instanceof Error ? e.message : String(e)}`));
        }
      }
      
      // Auto-run pi sync if API is reachable
      if (apiCheck.reachable && hasKey) {
        try {
          const { runSync } = await import("./sync.js");
          console.log(chalk.dim("  ◐ Running pi sync..."));
          await runSync(cwd, { includeGraph: true });
          actionsTaken.push("synced team artifacts");
        } catch (e) {
          console.log(chalk.yellow(`  ⚠ Could not sync: ${e instanceof Error ? e.message : String(e)}`));
        }
      }
      
      // Auto-run pi learn if needed
      if (needsLearn && apiCheck.reachable && hasKey) {
        try {
          const { runLearn } = await import("./learn.js");
          const withGraph = !graphExists && !hasServerGraph;
          console.log(chalk.dim(`  ◐ Running pi learn${withGraph ? " --with-graph" : ""}...`));
          await runLearn(cwd, undefined, { withGraph });
          actionsTaken.push(`learned codebase${withGraph ? " with graph" : ""}`);
        } catch (e) {
          console.log(chalk.red(`  ✗ Failed to run pi learn: ${e instanceof Error ? e.message : String(e)}`));
        }
      }
      
      // Re-check if we're now ready
      if (actionsTaken.length > 0) {
        console.log(chalk.green(`\n  ✓ Auto-fixed: ${actionsTaken.join(", ")}`));
        console.log(chalk.dim("\n  Run pi doctor again to see updated readiness score."));
      } else {
        console.log(chalk.yellow("\n  No automatic fixes could be applied."));
      }
    } else {
      // Show suggestions (original behavior)
      if (!hasKey) {
        console.log(chalk.cyan("  • Run pi-hokage to configure API key"));
      } else if (!apiCheck.reachable) {
        console.log(chalk.cyan("  • Check PI_CLI_BASE_URL and network connectivity"));
      }
      if (serverHealth && !serverHealth.ok) {
        if (!serverHealth.checks.default_model.configured)
          console.log(chalk.cyan("  • Server: set PI_MASTRA_DEFAULT_MODEL on Vercel"));
        if (!serverHealth.checks.postgres.reachable)
          console.log(chalk.cyan("  • Server: configure PI_CLI_DATABASE_URL (Supabase pooler, ?schema=mastra)"));
        if (!serverHealth.checks.workflow_mode.enabled)
          console.log(chalk.cyan("  • Server: set PI_CLI_USE_WORKFLOWS=true"));
        if (!serverHealth.checks.gemini.configured)
          console.log(chalk.cyan("  • Server: set GOOGLE_GENERATIVE_AI_API_KEY"));
      }
      if (!piDirExists) {
        console.log(chalk.cyan("  • Run pi init to create .pi/ directory"));
      }
      if (needsLearn) {
        console.log(chalk.cyan("  • Run pi learn to scan codebase"));
      }
      if (!graphExists && !hasServerGraph) {
        console.log(chalk.cyan("  • Run pi learn --with-graph for deeper analysis"));
      }
      if (health.isStale && styleAnalysis.exists && !styleAnalysis.isStub) {
        console.log(chalk.cyan("  • Run pi learn to refresh stale context"));
      }
      
      // Hint about --fix flag
      console.log(chalk.dim(`\n  Tip: Use ${chalk.cyan("pi doctor --fix")} to auto-run remediation commands.`));
    }
  }

  if (opts?.demo) {
    console.log(chalk.bold("\nDemo — Local AST Check"));
    const found = await findDemoSourceFile(cwd);
    if (!found) {
      console.log(chalk.dim("  No demo file found (app/layout.tsx, main.py, etc.)"));
    } else if (found.path.endsWith(".tsx") || found.path.endsWith(".jsx")) {
      const result = checkArchitecturalBoundaries(found.path, found.content);
      console.log(`  File: ${chalk.cyan(found.path)}`);
      console.log(
        `  Server component: ${result.is_server_component ? chalk.green("yes") : chalk.yellow("no (use client)")}`
      );
      console.log(`  "use client": ${result.has_use_client ? chalk.yellow("yes") : chalk.dim("no")}`);
      if (result.boundary_violations.length) {
        console.log(chalk.yellow("  Boundary notes:"));
        for (const v of result.boundary_violations) {
          console.log(chalk.dim(`    • ${v}`));
        }
      } else {
        console.log(chalk.green("  No boundary violations."));
      }
    } else {
      console.log(`  Found: ${chalk.cyan(found.path)} (non-React file — AST demo skipped)`);
    }
  } else {
    console.log(chalk.dim(`\n  Run ${chalk.cyan("pi doctor --demo")} for local AST check.`));
    console.log(chalk.dim(`  Run ${chalk.cyan("pi doctor --verbose")} for detailed language breakdown.`));
  }

  console.log("");
}
