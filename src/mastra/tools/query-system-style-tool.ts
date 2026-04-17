import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Deterministic slice of system-style JSON for semantic validation (no vector DB required).
 */
export const querySystemStyleTool = createTool({
  id: "query-system-style",
  description:
    "Given a system_style JSON string and a focus query, return a short bullet summary of relevant fields.",
  inputSchema: z.object({
    system_style_json: z.string().max(100_000),
    query: z.string().max(2000),
  }),
  outputSchema: z.object({
    summary: z.string(),
    keys_touched: z.array(z.string()),
  }),
  execute: async ({ system_style_json, query }) => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(system_style_json) as Record<string, unknown>;
    } catch {
      return { summary: "(invalid system_style JSON)", keys_touched: [] };
    }

    const q = query.toLowerCase();
    const keys = Object.keys(parsed).slice(0, 80);
    const keys_touched = keys.filter((k) => k.toLowerCase().includes(q) || q.split(/\s+/).some((w) => w.length > 2 && k.toLowerCase().includes(w)));

    const pick = keys_touched.length ? keys_touched : keys.slice(0, 12);
    const lines = pick.map((k) => {
      const v = parsed[k];
      const snippet =
        typeof v === "string"
          ? v.slice(0, 200)
          : JSON.stringify(v, null, 0).slice(0, 200);
      return `- ${k}: ${snippet}`;
    });

    return {
      summary: lines.join("\n").slice(0, 4000) || "(empty system_style)",
      keys_touched: pick,
    };
  },
});
