import { createWorkflow } from "@mastra/core/workflows";

import {
  medicationCheckWorkflowInputSchema,
  medicationCheckWorkflowOutputSchema,
} from "@/mastra/workflows/medication-check/schemas";
import { step1MedicationClassification } from "@/mastra/workflows/medication-check/steps/step1-input-classification";
import { step2MedicationSafety } from "@/mastra/workflows/medication-check/steps/step2-interaction-analysis";
import { step3MedicationOptimization } from "@/mastra/workflows/medication-check/steps/step3-optimization-review";
import { step4MedicationFinalize } from "@/mastra/workflows/medication-check/steps/step4-patient-communication";
import { step5MedicationAssembly } from "@/mastra/workflows/medication-check/steps/step5-report-assembly";

export const medicationCheckWorkflow = createWorkflow({
  id: "medication-check-workflow",
  inputSchema: medicationCheckWorkflowInputSchema,
  outputSchema: medicationCheckWorkflowOutputSchema,
})
  .then(step1MedicationClassification)
  .then(step2MedicationSafety)
  .then(step3MedicationOptimization)
  .then(step4MedicationFinalize)
  .then(step5MedicationAssembly)
  .commit();
