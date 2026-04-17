import { getMastraPostgresStore } from "@/lib/mastra-storage";

/**
 * Mastra CLI workflows require Postgres storage for snapshots, suspend/resume, and time travel.
 */
export function isPiCliWorkflowModeEnabled(): boolean {
  if (process.env.PI_CLI_USE_WORKFLOWS === "false") return false;
  return process.env.PI_CLI_USE_WORKFLOWS === "true" && Boolean(getMastraPostgresStore());
}

export function isPiCliRoutineHitlEnabled(): boolean {
  return process.env.PI_CLI_ROUTINE_HITL === "true" && Boolean(getMastraPostgresStore());
}
