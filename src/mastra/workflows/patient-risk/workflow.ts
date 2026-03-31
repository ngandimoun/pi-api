import { createWorkflow } from "@mastra/core/workflows";

import {
  patientRiskWorkflowInputSchema,
  patientRiskWorkflowOutputSchema,
} from "@/mastra/workflows/patient-risk/schemas";
import { step1PatientRiskClassification } from "@/mastra/workflows/patient-risk/steps/step1-input-classification";
import { step2PatientRiskAssessment } from "@/mastra/workflows/patient-risk/steps/step2-risk-assessment";
import { step3PatientRiskPriority } from "@/mastra/workflows/patient-risk/steps/step3-priority-ranking";
import { step4PatientRiskActions } from "@/mastra/workflows/patient-risk/steps/step4-action-plan";
import { step5PatientRiskAssembly } from "@/mastra/workflows/patient-risk/steps/step5-report-assembly";

export const patientRiskWorkflow = createWorkflow({
  id: "patient-risk-workflow",
  inputSchema: patientRiskWorkflowInputSchema,
  outputSchema: patientRiskWorkflowOutputSchema,
})
  .then(step1PatientRiskClassification)
  .then(step2PatientRiskAssessment)
  .then(step3PatientRiskPriority)
  .then(step4PatientRiskActions)
  .then(step5PatientRiskAssembly)
  .commit();
