import { z } from "zod";

import {
  streamAnalysisOutputSchema,
  streamCreateInputSchema,
} from "../../../contracts/surveillance-api";

export const surveillanceDiagnosticsStepSchema = z.object({
  step: z.string().min(1),
  status: z.enum(["ok", "failed"]),
  duration_ms: z.number().int().nonnegative(),
  detail: z.record(z.unknown()).default({}),
});

export const surveillanceStreamWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: streamCreateInputSchema,
});

export const surveillanceStreamWorkflowOutputSchema = z.object({
  output: streamAnalysisOutputSchema,
  diagnostics: z.array(surveillanceDiagnosticsStepSchema).default([]),
});
