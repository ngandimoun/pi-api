import { createWorkflow } from "@mastra/core/workflows";

import {
  surveillanceStreamWorkflowInputSchema,
  surveillanceStreamWorkflowOutputSchema,
} from "./schemas";
import { step1Perception } from "./steps/step1-perception";
import { step2PolicyEvaluation } from "./steps/step2-policy-evaluation";
import { step3Narration } from "./steps/step3-narration";
import { step4Assembly } from "./steps/step4-assembly";

export const surveillanceStreamWorkflow = createWorkflow({
  id: "surveillance-stream-workflow",
  inputSchema: surveillanceStreamWorkflowInputSchema,
  outputSchema: surveillanceStreamWorkflowOutputSchema,
})
  .then(step1Perception)
  .then(step2PolicyEvaluation)
  .then(step3Narration)
  .then(step4Assembly)
  .commit();
