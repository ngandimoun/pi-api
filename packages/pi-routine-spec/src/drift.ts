import type { RoutineSpecification } from "./schema.js";

export type DriftViolation = {
  routine_id: string;
  type: "missing_file" | "unexpected_file" | "constraint_violation";
  message: string;
  file?: string;
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Compare changed files (e.g. git diff) against a routine's files_manifest and optional file contents.
 * - **create** entries: path should appear in changedFiles (or exist check left to caller).
 * - **unexpected**: changed files not listed in manifest paths.
 * - **constraints**: when `fileContents` is provided, scan for must_use / must_not substrings.
 */
export function detectRoutineDrift(
  changedFiles: string[],
  routineSpec: RoutineSpecification,
  opts?: { fileContents?: Map<string, string> }
): DriftViolation[] {
  const violations: DriftViolation[] = [];
  const id = routineSpec.metadata.id;
  const manifest = routineSpec.files_manifest ?? [];
  const manifestPaths = new Set(manifest.map((f) => normalizePath(f.path)));
  const changed = changedFiles.map(normalizePath);

  for (const f of manifest.filter((x) => x.action === "create")) {
    const p = normalizePath(f.path);
    if (!changed.includes(p)) {
      violations.push({
        routine_id: id,
        type: "missing_file",
        message: `Expected create manifest path not in changed set: ${p}`,
        file: p,
      });
    }
  }

  for (const file of changed) {
    if (!manifestPaths.has(file)) {
      violations.push({
        routine_id: id,
        type: "unexpected_file",
        message: `Changed file not listed in routine files_manifest: ${file}`,
        file,
      });
    }
  }

  const contents = opts?.fileContents;
  if (contents?.size) {
    const { must_use: mu, must_not: mn } = routineSpec.context.constraints;
    for (const [relPath, text] of contents) {
      const n = normalizePath(relPath);
      for (const forbidden of mn ?? []) {
        if (forbidden.trim() && text.includes(forbidden)) {
          violations.push({
            routine_id: id,
            type: "constraint_violation",
            message: `must_not pattern found in ${n}: ${forbidden.slice(0, 120)}`,
            file: n,
          });
        }
      }
      for (const required of mu ?? []) {
        if (required.trim() && !text.includes(required)) {
          violations.push({
            routine_id: id,
            type: "constraint_violation",
            message: `must_use pattern missing in ${n}: ${required.slice(0, 120)}`,
            file: n,
          });
        }
      }
    }
  }

  return violations;
}
