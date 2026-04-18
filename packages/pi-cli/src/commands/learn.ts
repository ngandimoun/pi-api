import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import fg from "fast-glob";
import { injectPiContextToAllIDEs } from "../lib/agentic-ide-injector.js";
import { PiApiClient } from "../lib/api-client.js";
import { getPersona } from "../lib/config.js";
import { SYSTEM_STYLE_FILE } from "../lib/constants.js";
import { formatCommandBlock } from "../lib/persona.js";
import { readPiProjectConfig } from "../lib/pi-project-config.js";
import { collectPolyglotHints } from "../lib/polyglot-hints.js";
import { redactSource } from "../lib/privacy/redactor.js";
import { printPickUpWhereYouLeftOff } from "../lib/recovery-hints.js";
import { CommandTaskTracker } from "../lib/task-tracker.js";
import { scanRepoInChunks } from "../lib/ast/streaming-parser.js";
import { getCurrentBranch } from "../lib/vcs/index.js";
import { logWorkflowSpinnerTick, pollWorkflowUntilTerminal } from "../lib/workflow-client.js";
import type { WorkflowKey } from "../lib/workflow-poller.js";

function collectImports(source: string): string[] {
  const out = new Set<string>();
  const fromRe = /from\s+["']([^"']+)["']/g;
  const importRe = /import\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(source)) !== null) out.add(m[1]);
  while ((m = importRe.exec(source)) !== null) out.add(m[1]);
  return [...out];
}

function histogram(imports: string[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const i of imports) {
    const key = i.startsWith("@") ? i.split("/").slice(0, 2).join("/") : i.split("/")[0] ?? i;
    h[key] = (h[key] ?? 0) + 1;
  }
  return h;
}

const MAX_GRAPH_SOURCES = 10;
const MAX_GRAPH_BYTES = 32_000;

export async function runLearn(
  cwd: string,
  focus: string | undefined,
  opts?: { withGraph?: boolean; async?: boolean; dryRun?: boolean; streaming?: boolean }
): Promise<void> {
  const client = new PiApiClient();

  const pattern = focus ? `${focus.replace(/\\/g, "/")}/**/*.{ts,tsx,js,jsx}` : "**/*.{ts,tsx,js,jsx}";
  const files = await fg(pattern, {
    cwd,
    ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    absolute: true,
  });

  const streamThreshold = Number(process.env.PI_CLI_STREAMING_THRESHOLD ?? 200) || 200;
  const useStreaming =
    !opts?.dryRun && (Boolean(opts?.streaming) || files.length > streamThreshold);

  let import_histogram: Record<string, number>;
  let file_sample_paths: string[];

  if (useStreaming) {
    const r = await scanRepoInChunks(cwd, files);
    import_histogram = r.import_histogram;
    file_sample_paths = r.file_sample_paths;
    if (!opts?.dryRun) {
      console.log(
        chalk.dim(
          `Chunked scan: ${r.chunksProcessed} ts-morph chunk(s), ${files.length} files (streaming; avoids whole-repo AST OOM)`
        )
      );
    }
  } else {
    const sample = files.slice(0, 50);
    const allImports: string[] = [];
    for (const file of sample) {
      try {
        const src = await fs.readFile(file, "utf8");
        allImports.push(...collectImports(src));
      } catch {
        /* skip */
      }
    }
    import_histogram = histogram(allImports);
    file_sample_paths = sample.map((f) => path.relative(cwd, f));
  }

  let packageJson: Record<string, unknown> | undefined;
  try {
    packageJson = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    packageJson = undefined;
  }

  const deps = {
    ...((packageJson?.dependencies as Record<string, string>) ?? {}),
    ...((packageJson?.devDependencies as Record<string, string>) ?? {}),
  };
  const framework_hints: string[] = [];
  if (deps.next) framework_hints.push("next.js");
  if (deps.react) framework_hints.push("react");
  if (deps.tailwindcss) framework_hints.push("tailwind");
  if (deps.zustand) framework_hints.push("zustand");
  if (deps["@reduxjs/toolkit"] || deps.redux) framework_hints.push("redux");

  const file_sources: { path: string; content: string }[] = [];
  if (opts?.withGraph) {
    const graphSample = (useStreaming ? files : files.slice(0, 50)).slice(0, MAX_GRAPH_SOURCES);
    let total = 0;
    for (const file of graphSample) {
      try {
        const raw = await fs.readFile(file, "utf8");
        const { redacted } = redactSource(raw);
        const chunk = redacted.slice(0, 8000);
        if (total + chunk.length > MAX_GRAPH_BYTES) break;
        file_sources.push({ path: path.relative(cwd, file), content: chunk });
        total += chunk.length;
      } catch {
        /* skip */
      }
    }
  }

  const polyglot_hints = await collectPolyglotHints(cwd);

  // Scan for governance sources (WHY decisions, not just WHAT stack)
  const governance_sources: string[] = [];
  const governancePaths = [
    "AGENTS.md",
    ".pi/constitution.md",
    "docs/architecture/**/*.md",
    ".pi/decisions/**/*.md",
  ];
  
  for (const pattern of governancePaths) {
    try {
      const matches = await fg(pattern, { cwd, absolute: true, ignore: ["**/node_modules/**"] });
      for (const file of matches.slice(0, 5)) { // Max 5 per pattern to avoid overload
        try {
          const content = await fs.readFile(file, "utf8");
          const truncated = content.slice(0, 4000); // Truncate to 4k chars per file
          governance_sources.push(`### ${path.relative(cwd, file)}\n${truncated}`);
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip pattern */
    }
  }

  const metadata: {
    package_json?: Record<string, unknown>;
    import_histogram: Record<string, number>;
    file_sample_paths: string[];
    framework_hints: string[];
    polyglot_hints: typeof polyglot_hints;
    file_sources?: { path: string; content: string }[];
    governance_sources?: string[];
  } = {
    package_json: packageJson,
    import_histogram,
    file_sample_paths,
    framework_hints,
    polyglot_hints,
    ...(file_sources.length ? { file_sources } : {}),
    ...(governance_sources.length ? { governance_sources } : {}),
  };

  if (opts?.dryRun) {
    console.log(JSON.stringify({ metadata }, null, 2));
    console.log(chalk.gray("(dry-run: no API call)"));
    return;
  }

  const branch = (await getCurrentBranch(cwd)) ?? "unknown-branch";
  const tracker = new CommandTaskTracker("learn", "Repository DNA scan", { cwd, branch });
  tracker.startStep("scan", "Scan codebase & build metadata");
  tracker.completeStep("scan");
  tracker.startStep("api", "Pi learn API");

  const useAsync = Boolean(opts?.async) || process.env.PI_CLI_ASYNC === "true";
  const res = await client.learn({ metadata }, { async: useAsync });

  if (res.async && res.run_id && res.workflow_key) {
    tracker.linkWorkflowRun(res.run_id);
    try {
      process.stdout.write("\n");
      const done = await pollWorkflowUntilTerminal(client, res.workflow_key as WorkflowKey, res.run_id, {
        onTick: (n, ms) => logWorkflowSpinnerTick(n, ms),
      });
      console.log("");
      if (done.status !== "success") {
        tracker.failStep("api", new Error(String(done.status)));
        tracker.fail(new Error(`Learn workflow: ${done.status}`));
        console.error(chalk.red("Learn workflow did not succeed:"), done.status);
        printPickUpWhereYouLeftOff({ workflowRunId: res.run_id, cliRetryHint: "pi learn --async" });
        process.exitCode = 1;
        return;
      }
      const out = done.workflow_result as
        | {
            system_style: Record<string, unknown>;
            graph_job_triggered: boolean;
            rules_persisted: number;
          }
        | undefined;
      if (!out?.system_style) {
        tracker.fail(new Error("Missing workflow result"));
        console.error(chalk.red("Missing workflow result."));
        printPickUpWhereYouLeftOff({ workflowRunId: res.run_id, cliRetryHint: "pi learn --async" });
        process.exitCode = 1;
        return;
      }
      tracker.completeStep("api");
      tracker.startStep("write", "Write system-style & IDE hints");
      await fs.writeFile(path.join(cwd, SYSTEM_STYLE_FILE), JSON.stringify(out.system_style, null, 2), "utf8");
      console.log(chalk.green("✓"), "Wrote", SYSTEM_STYLE_FILE);
      console.log(chalk.gray("Graph job triggered:"), out.graph_job_triggered ? chalk.green("yes") : chalk.yellow("no"));
      console.log(
        chalk.gray("Rules persisted to memory:"),
        typeof out.rules_persisted === "number" ? chalk.cyan(String(out.rules_persisted)) : chalk.yellow("n/a")
      );
      if (process.env.PI_CLI_NO_AGENTIC_INJECT !== "1") {
        try {
          const inj = await injectPiContextToAllIDEs(cwd, { mode: "base" });
          if (inj.filesWritten.length) {
            console.log(chalk.dim("Agentic IDE hints updated:"), inj.filesWritten.join(", "));
          }
        } catch {
          /* non-fatal */
        }
      }
      tracker.completeStep("write");
      tracker.complete();
      await printLearnNextSteps(cwd);
      return;
    } catch (e) {
      tracker.failStep("api", e);
      tracker.fail(e);
      console.error(chalk.red(e instanceof Error ? e.message : String(e)));
      printPickUpWhereYouLeftOff({ workflowRunId: res.run_id, cliRetryHint: "pi learn --async" });
      process.exitCode = 1;
      return;
    }
  }

  const { system_style, graph_job_triggered, rules_persisted } = res;
  if (!system_style) {
    tracker.fail(new Error("Unexpected learn response"));
    console.error(chalk.red("Unexpected learn response."));
    process.exitCode = 1;
    return;
  }

  tracker.completeStep("api");
  tracker.startStep("write", "Write system-style & IDE hints");
  await fs.writeFile(path.join(cwd, SYSTEM_STYLE_FILE), JSON.stringify(system_style, null, 2), "utf8");

  console.log(chalk.green("✓"), "Wrote", SYSTEM_STYLE_FILE);
  console.log(chalk.gray("Graph job triggered:"), graph_job_triggered ? chalk.green("yes") : chalk.yellow("no"));
  if (typeof rules_persisted === "number") {
    console.log(chalk.gray("Rules persisted to memory:"), chalk.cyan(String(rules_persisted)));
  }
  if (process.env.PI_CLI_NO_AGENTIC_INJECT !== "1") {
    try {
      const inj = await injectPiContextToAllIDEs(cwd, { mode: "base" });
      if (inj.filesWritten.length) {
        console.log(chalk.dim("Agentic IDE hints updated:"), inj.filesWritten.join(", "));
      }
    } catch {
      /* non-fatal */
    }
  }
  tracker.completeStep("write");
  tracker.complete();
  await printLearnNextSteps(cwd);
}

async function printLearnNextSteps(cwd: string): Promise<void> {
  try {
    const projectCfg = await readPiProjectConfig(cwd);
    const persona = getPersona(projectCfg.persona);
    console.log("");
    console.log(chalk.bold("Next:"));
    console.log(
      formatCommandBlock(persona, [
        ["pi resonate \"your feature\"", "debate the architecture with Pi before you code"],
        ["pi routine \"your task\"", "generate a step-by-step build spec Pi will follow"],
        ["pi validate", "run Pi's checks against your current diff"],
      ]),
    );
  } catch {
    // non-fatal — don't let persona formatting break learn output
  }
}
