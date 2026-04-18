import fs from "node:fs/promises";
import path from "node:path";

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Pi plan management tool - allows agents to interact with routine plans (.dag.json / .progress.json).
 * Exposes plan operations currently only available via `pi routine next` CLI command.
 */

export const piPlanTool = createTool({
  id: "pi-plan",
  description:
    "Query or advance Pi routine plans. Use 'status' to see current phase, 'next' to get next phase path, 'advance' to unlock next phase.",
  inputSchema: z.object({
    action: z.enum(["status", "next", "advance"]),
    cwd: z.string(),
    routine_slug: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    current_phase_index: z.number().optional(),
    total_phases: z.number().optional(),
    current_phase_file: z.string().optional(),
    next_phase_file: z.string().optional(),
  }),
  execute: async ({ action, cwd, routine_slug }) => {
    try {
      // Find .dag.json - either specific routine or latest in .pi/routines/
      let dagPath: string;
      if (routine_slug) {
        dagPath = path.join(/* turbopackIgnore: true */ cwd, ".pi/routines", routine_slug, ".dag.json");
      } else {
        const routinesDir = path.join(/* turbopackIgnore: true */ cwd, ".pi/routines");
        const entries = await fs.readdir(routinesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory());

        let latestDag: { path: string; mtime: number } | null = null;
        for (const dir of dirs) {
          const candidatePath = path.join(/* turbopackIgnore: true */ routinesDir, dir.name, ".dag.json");
          try {
            const stat = await fs.stat(candidatePath);
            if (!latestDag || stat.mtimeMs > latestDag.mtime) {
              latestDag = { path: candidatePath, mtime: stat.mtimeMs };
            }
          } catch {
            continue;
          }
        }

        if (!latestDag) {
          return {
            success: false,
            message: "No .dag.json found in .pi/routines/",
          };
        }
        dagPath = latestDag.path;
      }

      const progressPath = path.join(path.dirname(dagPath), ".progress.json");

      const dagContent = await fs.readFile(dagPath, "utf8");
      const dag = JSON.parse(dagContent) as { phases: Array<{ id: string; title: string; file: string }> };

      let progress = { unlocked_phase_index: 0 };
      try {
        const progressContent = await fs.readFile(progressPath, "utf8");
        progress = JSON.parse(progressContent) as { unlocked_phase_index: number };
      } catch {
        // No progress file yet
      }

      const currentIndex = progress.unlocked_phase_index;
      const currentPhase = dag.phases[currentIndex];
      const nextPhase = dag.phases[currentIndex + 1];

      if (action === "status") {
        return {
          success: true,
          message: `Phase ${currentIndex + 1}/${dag.phases.length}: ${currentPhase?.title ?? "(none)"}`,
          current_phase_index: currentIndex,
          total_phases: dag.phases.length,
          current_phase_file: currentPhase?.file,
        };
      }

      if (action === "next") {
        return {
          success: true,
          message: nextPhase ? `Next phase: ${nextPhase.title}` : "All phases unlocked",
          current_phase_index: currentIndex,
          total_phases: dag.phases.length,
          current_phase_file: currentPhase?.file,
          next_phase_file: nextPhase?.file,
        };
      }

      if (action === "advance") {
        if (!nextPhase) {
          return {
            success: false,
            message: "Already at final phase",
            current_phase_index: currentIndex,
            total_phases: dag.phases.length,
          };
        }

        await fs.writeFile(
          progressPath,
          JSON.stringify({ unlocked_phase_index: currentIndex + 1 }, null, 2),
          "utf8"
        );

        return {
          success: true,
          message: `Advanced to phase ${currentIndex + 2}: ${nextPhase.title}`,
          current_phase_index: currentIndex + 1,
          total_phases: dag.phases.length,
          current_phase_file: nextPhase.file,
        };
      }

      return {
        success: false,
        message: `Unknown action: ${action}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Plan tool error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
