import { createWorkflow } from "@mastra/core/workflows";

import {
  healthTriageWorkflowInputSchema,
  healthTriageWorkflowOutputSchema,
} from "./schemas";
import { step1InputClassification } from "./steps/step1-input-classification";
import { step2Processing } from "./steps/step2-processing";
import { step3ClinicalInterpretation } from "./steps/step3-clinical-interpretation";
import { step4TreatmentPlan } from "./steps/step4-treatment-plan";
import { step5ReportAssembly } from "./steps/step5-report-assembly";

export const healthTriageWorkflow = createWorkflow({
  id: "health-triage-workflow",
  inputSchema: healthTriageWorkflowInputSchema,
  outputSchema: healthTriageWorkflowOutputSchema,
})
  .then(step1InputClassification)
  .then(step2Processing)
  .then(step3ClinicalInterpretation)
  .then(step4TreatmentPlan)
  .then(step5ReportAssembly)
  .commit();

