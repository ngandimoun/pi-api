import fs from "node:fs/promises";
import path from "node:path";
import { Project } from "ts-morph";

/**
 * Chunked repo scan to avoid loading a single ts-morph project with the entire codebase
 * (OOM on multi-million-line monorepos). Each chunk gets a fresh `Project`; sources are
 * dropped after processing so GC can reclaim AST memory.
 */

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

function mergeHistograms(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export type ChunkScanResult = {
  import_histogram: Record<string, number>;
  /** Relative paths sampled (capped for payload size). */
  file_sample_paths: string[];
  /** ts-morph projects created (for tests / introspection). */
  chunksProcessed: number;
};

/**
 * Walk `files` in chunks of `chunkSize`, parse each file with an ephemeral ts-morph `Project`,
 * extract import strings from source text, then remove all sources from the project.
 */
export async function scanRepoInChunks(
  cwd: string,
  files: string[],
  opts?: { chunkSize?: number; maxSamplePaths?: number }
): Promise<ChunkScanResult> {
  const chunkSize = opts?.chunkSize ?? (Number(process.env.PI_CLI_CHUNK_SIZE ?? 50) || 50);
  const maxSample = opts?.maxSamplePaths ?? 200;

  let import_histogram: Record<string, number> = {};
  const file_sample_paths: string[] = [];
  let chunksProcessed = 0;

  for (let i = 0; i < files.length; i += chunkSize) {
    const slice = files.slice(i, i + chunkSize);
    const project = new Project({
      compilerOptions: { target: 99, module: 99, jsx: 4, strict: true, allowJs: true },
      skipAddingFilesFromTsConfig: true,
    });

    try {
      for (const abs of slice) {
        try {
          const sf = project.addSourceFileAtPath(abs);
          const text = sf.getFullText();
          import_histogram = mergeHistograms(import_histogram, histogram(collectImports(text)));
          if (file_sample_paths.length < maxSample) {
            file_sample_paths.push(path.relative(cwd, abs).replace(/\\/g, "/"));
          }
        } catch {
          /* unreadable / binary */
        }
      }
    } finally {
      for (const sf of project.getSourceFiles()) {
        project.removeSourceFile(sf);
      }
      chunksProcessed += 1;
      if (typeof globalThis.gc === "function") {
        globalThis.gc();
      }
    }
  }

  return { import_histogram, file_sample_paths, chunksProcessed };
}
