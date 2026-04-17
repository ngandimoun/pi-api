import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { parseRoutineMarkdownLoose } from "pi-routine-spec";
import { redactSource } from "./privacy/redactor.js";
import { PI_ROUTINES_DIR } from "./constants.js";
import { listRoutines } from "./routine-library.js";
import { frameworkHintsFromDeps, mergePackageDeps } from "./stack-detection.js";

export type RoutineContextPayload = {
  file_sample_paths?: string[];
  file_excerpts?: { path: string; excerpt: string }[];
  import_histogram?: Record<string, number>;
  /** Normalized stack ids from package.json + optional repo signals */
  framework_hints?: string[];
  /** e.g. python when pyproject.toml / requirements.txt present */
  polyglot_hints?: string[];
  /** Sample paths under src/mastra (agents, tools, workflows) if present */
  mastra_artifact_sample_paths?: string[];
  existing_routine_slugs?: string[];
  existing_routines_metadata?: Array<{
    id: string;
    tags: string[];
    intent: string;
  }>;
  /** Dependency verification results (if available) */
  dependency_verification?: DependencyVerificationResult;
};

export type DependencyVerificationResult = {
  /** Dependencies declared in package.json but not found in imports */
  declared_but_unused: string[];
  /** Packages imported but not in package.json dependencies */
  used_but_not_declared: string[];
  /** Dependencies that are both declared and actually imported */
  verified_in_use: Record<string, number>;
  /** Total declared dependencies */
  total_declared: number;
  /** Total unique imports */
  total_imports: number;
};

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

function normalizePackageName(imp: string): string {
  if (imp.startsWith("@")) {
    return imp.split("/").slice(0, 2).join("/");
  }
  return imp.split("/")[0] ?? imp;
}

function isNodeBuiltin(pkg: string): boolean {
  const builtins = new Set([
    "assert", "buffer", "child_process", "cluster", "console", "constants",
    "crypto", "dgram", "dns", "domain", "events", "fs", "http", "http2",
    "https", "inspector", "module", "net", "os", "path", "perf_hooks",
    "process", "punycode", "querystring", "readline", "repl", "stream",
    "string_decoder", "sys", "timers", "tls", "trace_events", "tty", "url",
    "util", "v8", "vm", "wasi", "worker_threads", "zlib",
    "node:assert", "node:buffer", "node:child_process", "node:cluster",
    "node:console", "node:constants", "node:crypto", "node:dgram", "node:dns",
    "node:domain", "node:events", "node:fs", "node:http", "node:http2",
    "node:https", "node:inspector", "node:module", "node:net", "node:os",
    "node:path", "node:perf_hooks", "node:process", "node:punycode",
    "node:querystring", "node:readline", "node:repl", "node:stream",
    "node:string_decoder", "node:sys", "node:timers", "node:tls",
    "node:trace_events", "node:tty", "node:url", "node:util", "node:v8",
    "node:vm", "node:wasi", "node:worker_threads", "node:zlib",
  ]);
  return builtins.has(pkg) || pkg.startsWith("node:");
}

function isRelativeImport(imp: string): boolean {
  return imp.startsWith(".") || imp.startsWith("/");
}

/**
 * Verify declared dependencies vs actual usage in the codebase.
 * Returns information about declared-but-unused and used-but-not-declared packages.
 */
export async function verifyDependencyUsage(
  cwd: string,
  opts?: { maxFiles?: number }
): Promise<DependencyVerificationResult> {
  const maxFiles = opts?.maxFiles ?? 100;

  let packageJson: Record<string, unknown> | undefined;
  try {
    packageJson = JSON.parse(
      await fs.readFile(path.join(cwd, "package.json"), "utf8")
    ) as Record<string, unknown>;
  } catch {
    return {
      declared_but_unused: [],
      used_but_not_declared: [],
      verified_in_use: {},
      total_declared: 0,
      total_imports: 0,
    };
  }

  const declaredDeps = new Set<string>();
  const deps = (packageJson.dependencies ?? {}) as Record<string, string>;
  const devDeps = (packageJson.devDependencies ?? {}) as Record<string, string>;
  const peerDeps = (packageJson.peerDependencies ?? {}) as Record<string, string>;

  for (const dep of Object.keys(deps)) declaredDeps.add(dep);
  for (const dep of Object.keys(devDeps)) declaredDeps.add(dep);
  for (const dep of Object.keys(peerDeps)) declaredDeps.add(dep);

  const files = await fg("**/*.{ts,tsx,js,jsx,mjs,cjs}", {
    cwd,
    ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/build/**", "**/.git/**"],
    absolute: true,
  });

  const importCounts: Record<string, number> = {};
  const usedPackages = new Set<string>();

  for (const file of files.slice(0, maxFiles)) {
    try {
      const src = await fs.readFile(file, "utf8");
      const imports = collectImports(src);

      for (const imp of imports) {
        if (isRelativeImport(imp)) continue;
        if (isNodeBuiltin(imp)) continue;

        const pkg = normalizePackageName(imp);
        importCounts[pkg] = (importCounts[pkg] ?? 0) + 1;
        usedPackages.add(pkg);
      }
    } catch {
      /* skip unreadable files */
    }
  }

  const declared_but_unused: string[] = [];
  const used_but_not_declared: string[] = [];
  const verified_in_use: Record<string, number> = {};

  for (const pkg of declaredDeps) {
    if (usedPackages.has(pkg)) {
      verified_in_use[pkg] = importCounts[pkg] ?? 0;
    } else {
      declared_but_unused.push(pkg);
    }
  }

  for (const pkg of usedPackages) {
    if (!declaredDeps.has(pkg)) {
      used_but_not_declared.push(pkg);
    }
  }

  declared_but_unused.sort();
  used_but_not_declared.sort();

  return {
    declared_but_unused,
    used_but_not_declared,
    verified_in_use,
    total_declared: declaredDeps.size,
    total_imports: usedPackages.size,
  };
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9+/]+/g)
    .filter((w) => w.length > 2);
}

function scorePath(p: string, keywords: string[]): number {
  const x = p.toLowerCase();
  let n = 0;
  for (const k of keywords) if (x.includes(k)) n += 2;
  return n;
}

const MAX_EXCERPT_FILES = 10;
const MAX_GRAPH_BYTES = 32_000;

/**
 * Lightweight repo signals for Pi routine generation (matches server `routine_context`).
 */
export async function collectRoutineRepoContext(
  cwd: string,
  intent: string,
  opts?: { withExcerpts?: boolean; withDependencyVerification?: boolean }
): Promise<RoutineContextPayload> {
  const pattern = "**/*.{ts,tsx,js,jsx}";
  const files = await fg(pattern, {
    cwd,
    ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    absolute: true,
  });

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

  let packageJson: Record<string, unknown> | undefined;
  try {
    packageJson = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    packageJson = undefined;
  }

  const deps = packageJson ? mergePackageDeps(packageJson) : {};
  const framework_hints = frameworkHintsFromDeps(deps);
  try {
    await fs.access(path.join(cwd, "components.json"));
    if (!framework_hints.includes("shadcn-ui")) {
      framework_hints.push("shadcn-ui");
      framework_hints.sort();
    }
  } catch {
    /* no components.json */
  }

  const polyglot_hints: string[] = [];
  try {
    await fs.access(path.join(cwd, "pyproject.toml"));
    polyglot_hints.push("python");
  } catch {
    try {
      await fs.access(path.join(cwd, "requirements.txt"));
      polyglot_hints.push("python");
    } catch {
      /* not python at repo root */
    }
  }

  let mastra_artifact_sample_paths: string[] = [];
  try {
    const mastraFiles = await fg("src/mastra/**/*.{ts,tsx}", {
      cwd,
      ignore: ["**/node_modules/**"],
      absolute: true,
    });
    mastra_artifact_sample_paths = mastraFiles.slice(0, 20).map((f) => path.relative(cwd, f));
  } catch {
    mastra_artifact_sample_paths = [];
  }

  const import_histogram = histogram(allImports);
  const file_sample_paths = sample.map((f) => path.relative(cwd, f));

  const routines = await listRoutines(cwd);
  const existing_routine_slugs = [...new Set(routines.map((r) => r.id))];

  const existing_routines_metadata: RoutineContextPayload["existing_routines_metadata"] = [];
  for (const r of routines) {
    if (!r.enhanced) continue;
    const abs = path.join(cwd, PI_ROUTINES_DIR, r.filename);
    try {
      const raw = await fs.readFile(abs, "utf8");
      const parsed = parseRoutineMarkdownLoose(raw);
      if (parsed?.meta?.id) {
        existing_routines_metadata.push({
          id: parsed.meta.id,
          tags: parsed.meta.tags ?? [],
          intent: parsed.meta.intent ?? "",
        });
      }
    } catch {
      /* skip */
    }
  }

  const payload: RoutineContextPayload = {
    file_sample_paths,
    import_histogram,
    framework_hints,
    existing_routine_slugs,
    ...(polyglot_hints.length ? { polyglot_hints } : {}),
    ...(mastra_artifact_sample_paths.length ? { mastra_artifact_sample_paths } : {}),
    ...(existing_routines_metadata.length ? { existing_routines_metadata } : {}),
  };

  if (opts?.withExcerpts) {
    const keywords = tokenize(intent);
    const ranked = sample
      .map((abs) => ({ abs, score: scorePath(path.relative(cwd, abs), keywords) }))
      .sort((a, b) => b.score - a.score);

    const file_excerpts: { path: string; excerpt: string }[] = [];
    let total = 0;
    for (const { abs } of ranked.slice(0, MAX_EXCERPT_FILES)) {
      try {
        const raw = await fs.readFile(abs, "utf8");
        const { redacted } = redactSource(raw);
        const chunk = redacted.slice(0, 8000);
        if (total + chunk.length > MAX_GRAPH_BYTES) break;
        file_excerpts.push({ path: path.relative(cwd, abs), excerpt: chunk });
        total += chunk.length;
      } catch {
        /* skip */
      }
    }
    if (file_excerpts.length) payload.file_excerpts = file_excerpts;
  }

  if (opts?.withDependencyVerification) {
    payload.dependency_verification = await verifyDependencyUsage(cwd);
  }

  return payload;
}
