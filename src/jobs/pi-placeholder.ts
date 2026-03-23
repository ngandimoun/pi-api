import { task } from "@trigger.dev/sdk/v3";

/**
 * Placeholder Trigger.dev task — replace with real domain jobs.
 * Heavy work (> ~5s) should run here, not inline in Route Handlers.
 */
export const piPlaceholder = task({
  id: "pi-placeholder",
  run: async () => {
    return { ok: true as const };
  },
});
