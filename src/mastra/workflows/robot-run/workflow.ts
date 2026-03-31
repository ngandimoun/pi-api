import { createWorkflow } from "@mastra/core/workflows";

import { robotRunWorkflowInputSchema, robotRunWorkflowOutputSchema } from "./schemas";
import { step1Perception } from "./steps/step1-perception";
import { step2SpatialEval } from "./steps/step2-spatial-eval";
import { step3BehaviorEval } from "./steps/step3-behavior-eval";
import { step4Decision } from "./steps/step4-decision";
import { step5Assembly } from "./steps/step5-assembly";

export const robotRunWorkflow = createWorkflow({
  id: "robot-run-workflow",
  inputSchema: robotRunWorkflowInputSchema,
  outputSchema: robotRunWorkflowOutputSchema,
})
  .then(step1Perception)
  .then(step2SpatialEval)
  .then(step3BehaviorEval)
  .then(step4Decision)
  .then(step5Assembly)
  .commit();

