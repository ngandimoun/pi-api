import { Mastra } from "@mastra/core";
import { demoAgent } from "@/mastra/agents/demo-agent";
import { campaignAdsWorkflow } from "@/mastra/workflows/campaign-ads/workflow";
import { campaignLocalizeWorkflow } from "@/mastra/workflows/campaign-localize/workflow";
import { uppercaseWorkflow } from "@/mastra/workflows/uppercase-workflow";

export const mastra = new Mastra({
  workflows: {
    uppercaseWorkflow,
    campaignAdsWorkflow,
    campaignLocalizeWorkflow,
  },
  agents: {
    demoAgent,
  },
});

