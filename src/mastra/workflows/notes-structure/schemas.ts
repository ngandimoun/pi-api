import { z } from "zod";

import {
  notesStructureDiagnosticsStepSchema,
  notesStructureInputSchema,
  notesStructureOutputSchema,
} from "@/contracts/notes-structure-api";

export { notesStructureDiagnosticsStepSchema };

export const notesStructureWorkflowInputSchema = z.object({
  job_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  input: notesStructureInputSchema,
});

export const notesStructureWorkflowOutputSchema = z.object({
  output: notesStructureOutputSchema,
  diagnostics: z.array(notesStructureDiagnosticsStepSchema).default([]),
});
