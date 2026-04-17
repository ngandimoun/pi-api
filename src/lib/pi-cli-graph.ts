/**
 * Dependency graph built from in-repo source snapshots (no filesystem on Trigger workers).
 */
export type DependencyGraph = {
  nodes: { id: string; kind: string }[];
  edges: { from: string; to: string; kind: string }[];
};

const IMPORT_FROM = /(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g;
const IMPORT_SIDE = /import\s+['"]([^'"]+)['"]/g;

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function resolveRelativeImport(fromPath: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const dir = fromPath.replace(/\\/g, "/").replace(/\/[^/]+$/, "");
  const parts = `${dir}/${specifier}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function tryResolveToKnownFile(resolved: string, known: Set<string>): string | null {
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
  ];
  for (const c of candidates) {
    if (known.has(c)) return c;
  }
  return null;
}

function extractImportSpecifiers(source: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  IMPORT_FROM.lastIndex = 0;
  while ((m = IMPORT_FROM.exec(source)) !== null) out.add(m[1]);
  IMPORT_SIDE.lastIndex = 0;
  while ((m = IMPORT_SIDE.exec(source)) !== null) out.add(m[1]);
  return [...out];
}

/**
 * Build an import graph from virtual file snapshots (used on serverless / Trigger workers).
 */
export function buildImportGraphFromSources(
  files: { path: string; content: string }[]
): DependencyGraph {
  const normalizedPaths = files.map((f) => normalizeRelPath(f.path));
  const known = new Set(normalizedPaths);
  const nodes = normalizedPaths.map((id) => ({ id, kind: "source" }));
  const edges: DependencyGraph["edges"] = [];

  for (const file of files) {
    const from = normalizeRelPath(file.path);
    const specs = extractImportSpecifiers(file.content);
    for (const spec of specs) {
      const resolved = resolveRelativeImport(from, spec);
      if (!resolved) continue;
      const to = tryResolveToKnownFile(resolved, known);
      if (to) {
        edges.push({ from, to, kind: "imports" });
      }
    }
  }

  return { nodes, edges };
}
