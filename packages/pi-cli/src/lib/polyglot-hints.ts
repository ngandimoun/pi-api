import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

import { buildPolyglotHintsGlob } from "./rules/polyglot-extensions.js";

const POLYGLOT_GLOB = buildPolyglotHintsGlob();

function extOf(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const idx = base.lastIndexOf(".");
  if (idx < 0) return "";
  return base.slice(idx).toLowerCase();
}

/**
 * Cheap polyglot repo fingerprinting (counts + samples) without parsing.
 * This complements TS/React analysis (ts-morph) for `pi learn`.
 */
export async function collectPolyglotHints(cwd: string): Promise<{
  counts_by_extension: Record<string, number>;
  sample_paths: string[];
}> {
  const files = await fg(POLYGLOT_GLOB, {
    cwd,
    ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.git/**"],
    absolute: false,
  });

  const counts: Record<string, number> = {};
  for (const f of files) {
    const ext = extOf(f) || "<noext>";
    counts[ext] = (counts[ext] ?? 0) + 1;
  }

  const sample_paths = files.slice(0, 200).map((f) => f.replace(/\\/g, "/"));

  return { counts_by_extension: counts, sample_paths };
}

export function summarizePolyglotHints(h: { counts_by_extension: Record<string, number> }): string {
  const top = Object.entries(h.counts_by_extension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([ext, n]) => `${ext}:${n}`)
    .join(", ");
  return top || "(none)";
}

export type PythonAnalysis = {
  detected: boolean;
  requirements: string[];
  pyproject_deps: string[];
  import_histogram: Record<string, number>;
  frameworks: string[];
};

export type GoAnalysis = {
  detected: boolean;
  module_name?: string;
  dependencies: string[];
  go_version?: string;
};

export type RustAnalysis = {
  detected: boolean;
  crate_name?: string;
  dependencies: string[];
  edition?: string;
};

export type EnhancedPolyglotHints = {
  counts_by_extension: Record<string, number>;
  sample_paths: string[];
  python?: PythonAnalysis;
  go?: GoAnalysis;
  rust?: RustAnalysis;
  primary_language?: string;
  frameworks: string[];
};

async function readFileSafe(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

function parsePythonImports(source: string): string[] {
  const imports = new Set<string>();
  const importRe = /^(?:from\s+(\S+)|import\s+(\S+))/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source)) !== null) {
    const mod = (m[1] ?? m[2] ?? "").split(".")[0].split(",")[0].trim();
    if (mod && !mod.startsWith("_")) {
      imports.add(mod);
    }
  }
  return [...imports];
}

function parseRequirementsTxt(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => {
      const match = line.match(/^([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    })
    .filter((pkg): pkg is string => pkg !== null);
}

function parsePyprojectDeps(content: string): string[] {
  const deps: string[] = [];

  const depsMatch = content.match(/\[project\.dependencies\]\s*\n([\s\S]*?)(?=\n\[|$)/);
  if (depsMatch) {
    const lines = depsMatch[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*"?([a-zA-Z0-9_-]+)/);
      if (match) deps.push(match[1]);
    }
  }

  const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]\s*\n([\s\S]*?)(?=\n\[|$)/);
  if (poetryMatch) {
    const lines = poetryMatch[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
      if (match && match[1] !== "python") deps.push(match[1]);
    }
  }

  return [...new Set(deps)];
}

function detectPythonFrameworks(deps: string[], imports: Record<string, number>): string[] {
  const frameworks: string[] = [];
  const allPkgs = new Set([...deps, ...Object.keys(imports)]);

  if (allPkgs.has("django") || allPkgs.has("Django")) frameworks.push("Django");
  if (allPkgs.has("flask") || allPkgs.has("Flask")) frameworks.push("Flask");
  if (allPkgs.has("fastapi") || allPkgs.has("FastAPI")) frameworks.push("FastAPI");
  if (allPkgs.has("streamlit")) frameworks.push("Streamlit");
  if (allPkgs.has("gradio")) frameworks.push("Gradio");
  if (allPkgs.has("pytorch") || allPkgs.has("torch")) frameworks.push("PyTorch");
  if (allPkgs.has("tensorflow") || allPkgs.has("tf")) frameworks.push("TensorFlow");
  if (allPkgs.has("langchain")) frameworks.push("LangChain");
  if (allPkgs.has("pandas")) frameworks.push("Pandas");
  if (allPkgs.has("numpy")) frameworks.push("NumPy");
  if (allPkgs.has("scipy")) frameworks.push("SciPy");
  if (allPkgs.has("sklearn") || allPkgs.has("scikit-learn")) frameworks.push("scikit-learn");
  if (allPkgs.has("pytest")) frameworks.push("pytest");

  return frameworks;
}

async function analyzePython(cwd: string): Promise<PythonAnalysis | undefined> {
  const pyFiles = await fg("**/*.py", {
    cwd,
    ignore: ["**/node_modules/**", "**/.venv/**", "**/venv/**", "**/__pycache__/**", "**/dist/**", "**/.git/**"],
    absolute: true,
  });

  if (pyFiles.length === 0) return undefined;

  let requirements: string[] = [];
  const reqContent = await readFileSafe(path.join(cwd, "requirements.txt"));
  if (reqContent) {
    requirements = parseRequirementsTxt(reqContent);
  }

  let pyproject_deps: string[] = [];
  const pyprojectContent = await readFileSafe(path.join(cwd, "pyproject.toml"));
  if (pyprojectContent) {
    pyproject_deps = parsePyprojectDeps(pyprojectContent);
  }

  const import_histogram: Record<string, number> = {};
  const filesToScan = pyFiles.slice(0, 50);
  for (const file of filesToScan) {
    const content = await readFileSafe(file);
    if (content) {
      const imports = parsePythonImports(content);
      for (const imp of imports) {
        import_histogram[imp] = (import_histogram[imp] ?? 0) + 1;
      }
    }
  }

  const allDeps = [...new Set([...requirements, ...pyproject_deps])];
  const frameworks = detectPythonFrameworks(allDeps, import_histogram);

  return {
    detected: true,
    requirements,
    pyproject_deps,
    import_histogram,
    frameworks,
  };
}

function parseGoMod(content: string): { module?: string; goVersion?: string; deps: string[] } {
  const deps: string[] = [];
  let module: string | undefined;
  let goVersion: string | undefined;

  const moduleMatch = content.match(/^module\s+(\S+)/m);
  if (moduleMatch) module = moduleMatch[1];

  const goMatch = content.match(/^go\s+(\S+)/m);
  if (goMatch) goVersion = goMatch[1];

  const requireBlock = content.match(/require\s*\(\s*([\s\S]*?)\s*\)/);
  if (requireBlock) {
    const lines = requireBlock[1].split("\n");
    for (const line of lines) {
      const match = line.trim().match(/^(\S+)\s+/);
      if (match && !match[1].startsWith("//")) {
        deps.push(match[1]);
      }
    }
  }

  const singleRequire = content.matchAll(/^require\s+(\S+)\s+/gm);
  for (const match of singleRequire) {
    if (match[1] && !match[1].startsWith("(")) {
      deps.push(match[1]);
    }
  }

  return { module, goVersion, deps: [...new Set(deps)] };
}

async function analyzeGo(cwd: string): Promise<GoAnalysis | undefined> {
  const goModContent = await readFileSafe(path.join(cwd, "go.mod"));
  if (!goModContent) return undefined;

  const { module, goVersion, deps } = parseGoMod(goModContent);

  return {
    detected: true,
    module_name: module,
    dependencies: deps,
    go_version: goVersion,
  };
}

function parseCargoToml(content: string): { name?: string; edition?: string; deps: string[] } {
  const deps: string[] = [];
  let name: string | undefined;
  let edition: string | undefined;

  const nameMatch = content.match(/^\s*name\s*=\s*"([^"]+)"/m);
  if (nameMatch) name = nameMatch[1];

  const editionMatch = content.match(/^\s*edition\s*=\s*"([^"]+)"/m);
  if (editionMatch) edition = editionMatch[1];

  const depsSection = content.match(/\[dependencies\]\s*\n([\s\S]*?)(?=\n\[|$)/);
  if (depsSection) {
    const lines = depsSection[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
      if (match) deps.push(match[1]);
    }
  }

  const devDepsSection = content.match(/\[dev-dependencies\]\s*\n([\s\S]*?)(?=\n\[|$)/);
  if (devDepsSection) {
    const lines = devDepsSection[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
      if (match) deps.push(match[1]);
    }
  }

  return { name, edition, deps: [...new Set(deps)] };
}

async function analyzeRust(cwd: string): Promise<RustAnalysis | undefined> {
  const cargoContent = await readFileSafe(path.join(cwd, "Cargo.toml"));
  if (!cargoContent) return undefined;

  const { name, edition, deps } = parseCargoToml(cargoContent);

  return {
    detected: true,
    crate_name: name,
    dependencies: deps,
    edition,
  };
}

function determinePrimaryLanguage(counts: Record<string, number>): string | undefined {
  const langMap: Record<string, string> = {
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".cs": "C#",
    ".php": "PHP",
    ".rb": "Ruby",
    ".swift": "Swift",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
  };

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [ext] of sorted) {
    if (langMap[ext]) return langMap[ext];
  }
  return undefined;
}

/**
 * Enhanced polyglot repo analysis with deeper inspection for Python, Go, and Rust.
 */
export async function collectPolyglotHintsEnhanced(cwd: string): Promise<EnhancedPolyglotHints> {
  const basic = await collectPolyglotHints(cwd);
  const frameworks: string[] = [];

  const pythonAnalysis = await analyzePython(cwd);
  const goAnalysis = await analyzeGo(cwd);
  const rustAnalysis = await analyzeRust(cwd);

  if (pythonAnalysis?.frameworks) {
    frameworks.push(...pythonAnalysis.frameworks);
  }

  const primary_language = determinePrimaryLanguage(basic.counts_by_extension);

  return {
    ...basic,
    python: pythonAnalysis,
    go: goAnalysis,
    rust: rustAnalysis,
    primary_language,
    frameworks,
  };
}

export function summarizeEnhancedPolyglotHints(h: EnhancedPolyglotHints): string {
  const parts: string[] = [];

  if (h.primary_language) {
    parts.push(`Primary: ${h.primary_language}`);
  }

  if (h.python?.detected) {
    const depCount = h.python.requirements.length + h.python.pyproject_deps.length;
    parts.push(`Python (${depCount} deps)`);
  }

  if (h.go?.detected && h.go.module_name) {
    parts.push(`Go (${h.go.dependencies.length} deps)`);
  }

  if (h.rust?.detected && h.rust.crate_name) {
    parts.push(`Rust (${h.rust.dependencies.length} deps)`);
  }

  if (h.frameworks.length > 0) {
    parts.push(`Frameworks: ${h.frameworks.slice(0, 5).join(", ")}`);
  }

  return parts.join(" | ") || summarizePolyglotHints(h);
}
