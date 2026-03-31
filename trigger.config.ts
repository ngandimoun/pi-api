import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev configuration for Pi API background workers.
 * Set `TRIGGER_PROJECT_REF` in your environment (see `.env.example`).
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "replace_with_trigger_project_ref",
  dirs: ["./src/jobs"],
  tsconfig: "./tsconfig.trigger.json",
  /** Global ceiling for task runs (seconds). Override per-task in Trigger.dev as needed. */
  maxDuration: 3600,
});
