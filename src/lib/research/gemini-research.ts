import { getCampaignGeminiClient } from "@/lib/campaigns/gemini-client";
import {
  generateHealthJsonWithRetry,
  getHealthGeminiModelId,
  parseJsonObject,
} from "@/lib/health/gemini-fallback";
import { runClinicalTextJsonChain } from "@/lib/clinical/clinical-json-fallback";

const S2 = {
  type: "object",
  additionalProperties: false,
  properties: {
    analysis_summary: { type: "string" },
    statistical_insights: { type: "array", items: { type: "object", additionalProperties: true } },
    data_quality_issues: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  required: ["analysis_summary", "statistical_insights", "data_quality_issues"],
} as const;

const S3 = {
  type: "object",
  additionalProperties: false,
  properties: {
    methodology_review: { type: "object", additionalProperties: true },
    literature_connections: { type: "array", items: { type: "object", additionalProperties: true } },
    visualization_suggestions: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  required: ["methodology_review", "literature_connections", "visualization_suggestions"],
} as const;

const S4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    next_steps: { type: "array", items: { type: "string" } },
    draft_sections: { type: "object", additionalProperties: true },
    ethical_considerations: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: ["next_steps", "draft_sections", "ethical_considerations", "disclaimer"],
} as const;

async function gj(system: string, user: string, schema: Record<string, unknown>, requestId: string) {
  const ai = getCampaignGeminiClient();
  const model = getHealthGeminiModelId();
  const { text } = await generateHealthJsonWithRetry({
    ai,
    primaryModel: model,
    contents: [{ role: "user", parts: [{ text: [system, "", user].join("\n") }] }],
    schema,
  });
  return parseJsonObject(text);
}

export async function researchStep2(params: {
  requestId: string;
  locale?: string;
  userBlock: string;
}) {
  return gj(
    "Analyze research query / dataset description. Suggest stats and flag data quality. Not a substitute for biostatistician. JSON only.",
    params.userBlock,
    S2 as unknown as Record<string, unknown>,
    params.requestId
  );
}

export async function researchStep3(params: {
  requestId: string;
  locale?: string;
  userBlock: string;
  step2: Record<string, unknown>;
}) {
  const user = `${params.userBlock}\n\nPrior (JSON): ${JSON.stringify(params.step2).slice(0, 40_000)}`;
  return gj(
    "Review methodology, connect to literature themes, suggest visualizations. JSON only.",
    user,
    S3 as unknown as Record<string, unknown>,
    params.requestId
  );
}

export async function researchStep4(params: {
  requestId: string;
  locale?: string;
  userBlock: string;
  step2: Record<string, unknown>;
  step3: Record<string, unknown>;
}) {
  const user = [
    params.userBlock.slice(0, 30_000),
    `Analysis (JSON): ${JSON.stringify(params.step2).slice(0, 24_000)}`,
    `Synthesis (JSON): ${JSON.stringify(params.step3).slice(0, 24_000)}`,
  ].join("\n");
  return runClinicalTextJsonChain({
    requestId: params.requestId,
    locale: params.locale,
    systemPrompt:
      "Produce next research steps, optional draft section stubs, ethics checklist, disclaimer. JSON only.",
    userContent: user,
    schemaName: "ResearchFinalize",
    jsonSchema: S4 as unknown as Record<string, unknown>,
  });
}
