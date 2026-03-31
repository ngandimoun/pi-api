import { createWorkflow } from "@mastra/core/workflows";

import {
  adherenceWorkflowInputSchema,
  adherenceWorkflowOutputSchema,
} from "@/mastra/workflows/adherence/schemas";
import { step1AdherenceClassification } from "@/mastra/workflows/adherence/steps/step1-input-classification";
import { step2AdherencePatterns } from "@/mastra/workflows/adherence/steps/step2-pattern-analysis";
import { step3AdherenceRisk } from "@/mastra/workflows/adherence/steps/step3-risk-prediction";
import { step4AdherenceInterventions } from "@/mastra/workflows/adherence/steps/step4-intervention-planning";
import { step5AdherenceAssembly } from "@/mastra/workflows/adherence/steps/step5-report-assembly";

export const adherenceWorkflow = createWorkflow({
  id: "adherence-workflow",
  inputSchema: adherenceWorkflowInputSchema,
  outputSchema: adherenceWorkflowOutputSchema,
})
  .then(step1AdherenceClassification)
  .then(step2AdherencePatterns)
  .then(step3AdherenceRisk)
  .then(step4AdherenceInterventions)
  .then(step5AdherenceAssembly)
  .commit();
