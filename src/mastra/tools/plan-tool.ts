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
    "Query or advance Pi routine plans for one routine (pass routine_slug). Use 'status' for current phase, 'next' for next path, 'advance' to unlock.",
  inputSchema: z.object({
    action: z.enum(["status", "next", "advance"]),
    cwd: z.string(),
    routine_slug: z.string().min(1),
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
      // Require routine_slug: scanning `.pi/routines` with `readdir` on user-controlled `cwd`
      // makes Turbopack/NFT treat the trace as unbounded (pulls repo root + next.config into lambdas).
      if (!routine_slug?.trim()) {
        return {
          success: false,
          message:
            "routine_slug is required (e.g. the folder name under .pi/routines/<slug>). Automatic discovery is disabled in server builds.",
        };
      }

      const dagPath = path.join(/* turbopackIgnore: true */ cwd, ".pi/routines", routine_slug.trim(), ".dag.json");

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
