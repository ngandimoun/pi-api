import { Agent } from "@mastra/core/agent";
import { demoWeatherTool } from "@/mastra/tools/demo-weather-tool";
import { getMastraDefaultModel } from "@/mastra/model";

export const demoAgent = new Agent({
  id: "demo-agent",
  name: "Demo Agent",
  instructions: [
    "You are a minimal demo agent used to establish repository conventions.",
    "When a user asks about weather, use the demoWeatherTool.",
    "Otherwise, answer normally and keep responses concise.",
  ].join("\n"),
  model: getMastraDefaultModel(),
  tools: { demoWeatherTool },
});

