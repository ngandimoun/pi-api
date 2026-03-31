import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Surveillance-only Trigger.dev config for fastest local iteration.
 * Bundles only the surveillance analyzer + webhook delivery task.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "replace_with_trigger_project_ref",
  dirs: ["./src/jobs-surveillance"],
  tsconfig: "./tsconfig.trigger.json",
  maxDuration: 3600,
  build: {
    external: ["utf-8-validate", "bufferutil"],
  },
});

