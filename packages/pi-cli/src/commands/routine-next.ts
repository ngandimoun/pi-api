import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";

import { PI_ROUTINES_DIR } from "../lib/constants.js";

/**
 * Progressive routine handoff: show the current phase file; use --advance after `pi check` passes.
 */
export async function runRoutineNext(
  cwd: string,
  routineSlug: string,
  opts?: { advance?: boolean }
): Promise<void> {
  const safe = routineSlug.replace(/[^a-z0-9-_]/gi, "-");
  const base = path.join(cwd, PI_ROUTINES_DIR, safe);
  const progressPath = path.join(base, ".progress.json");
  const dagPath = path.join(base, ".dag.json");

  let dag: { phases?: { id: string; title: string; file: string }[] };
  try {
    dag = JSON.parse(await fs.readFile(dagPath, "utf8")) as {
      phases?: { id: string; title: string; file: string }[];
    };
  } catch {
    console.error(
      chalk.red("No .dag.json — generate a v2 routine that includes routine_spec_json (progressive phases).")
    );
    process.exitCode = 1;
    return;
  }

  let progress: { unlocked_phase_index?: number };
  try {
    progress = JSON.parse(await fs.readFile(progressPath, "utf8")) as { unlocked_phase_index?: number };
  } catch {
    console.error(chalk.red("No .progress.json"));
    process.exitCode = 1;
    return;
  }

  const phases = dag.phases ?? [];
  if (!phases.length) {
    console.log(chalk.yellow("No phases in DAG."));
    return;
  }

  let idx = Math.min(progress.unlocked_phase_index ?? 0, phases.length - 1);

  if (opts?.advance) {
    if (idx >= phases.length - 1) {
      console.log(chalk.green("Final phase complete. Ship it."));
      return;
    }
    
    // D4: Validate dependencies before advancing
    const nextPhase = phases[idx + 1];
    if (nextPhase && "depends_on_phases" in nextPhase && Array.isArray(nextPhase.depends_on_phases)) {
      const deps = nextPhase.depends_on_phases as string[];
      const unlockedPhases = phases.slice(0, idx + 1).map(p => p.id);
      const missingDeps = deps.filter(dep => !unlockedPhases.includes(dep));
      
      if (missingDeps.length > 0) {
        console.log(chalk.red("Cannot advance: missing dependencies"));
        console.log(chalk.yellow(`Phase "${nextPhase.title}" depends on: ${deps.join(", ")}`));
        console.log(chalk.yellow(`Missing: ${missingDeps.join(", ")}`));
        return;
      }
    }
    
    idx += 1;
    progress.unlocked_phase_index = idx;
    await fs.writeFile(progressPath, JSON.stringify(progress, null, 2), "utf8");
  }

  const ph = phases[idx];
  const rel = path.join(PI_ROUTINES_DIR, safe, ph.file).replace(/\\/g, "/");
  console.log(chalk.bold("Phase focus:"), chalk.cyan(ph.title));
  console.log(chalk.dim("File:"), rel);
  if (idx < phases.length - 1) {
    console.log(chalk.gray(`After pi check: pi routine next ${safe} --advance`));
  } else {
    console.log(chalk.gray("Last phase — validate and merge."));
  }
}
