import { createWorkflow } from "@mastra/core/workflows";

import {
  decisionSupportWorkflowInputSchema,
  decisionSupportWorkflowOutputSchema,
} from "@/mastra/workflows/decision-support/schemas";
import { step1DecisionClassification } from "@/mastra/workflows/decision-support/steps/step1-input-classification";
import { step2DecisionEvidence } from "@/mastra/workflows/decision-support/steps/step2-evidence-synthesis";
import { step3DecisionCore } from "@/mastra/workflows/decision-support/steps/step3-decision-generation";
import { step4DecisionSafety } from "@/mastra/workflows/decision-support/steps/step4-safety-check";
import { step5DecisionAssembly } from "@/mastra/workflows/decision-support/steps/step5-report-assembly";

export const decisionSupportWorkflow = createWorkflow({
  id: "decision-support-workflow",
  inputSchema: decisionSupportWorkflowInputSchema,
  outputSchema: decisionSupportWorkflowOutputSchema,
})
  .then(step1DecisionClassification)
  .then(step2DecisionEvidence)
  .then(step3DecisionCore)
  .then(step4DecisionSafety)
  .then(step5DecisionAssembly)
  .commit();
