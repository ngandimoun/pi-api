import { z } from "zod";

import { robotRunInputSchema, robotRunOutputSchema } from "../../../contracts/robotics-api";

export const robotDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export const robotRunWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: robotRunInputSchema,
});

export const robotRunWorkflowOutputSchema = z.object({
  output: robotRunOutputSchema,
  diagnostics: z.array(robotDiagnosticsStepSchema).default([]),
});

