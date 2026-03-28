import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const demoWeatherTool = createTool({
  id: "demo-weather",
  description: "Demo tool: returns a fake weather string for a location.",
  inputSchema: z.object({
    location: z.string(),
  }),
  outputSchema: z.object({
    weather: z.string(),
  }),
  execute: async ({ location }) => {
    return { weather: `${location}: sunny` };
  },
});

