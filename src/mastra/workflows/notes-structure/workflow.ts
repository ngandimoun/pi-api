import { createWorkflow } from "@mastra/core/workflows";

import {
  notesStructureWorkflowInputSchema,
  notesStructureWorkflowOutputSchema,
} from "@/mastra/workflows/notes-structure/schemas";
import { step1NotesClassification } from "@/mastra/workflows/notes-structure/steps/step1-input-classification";
import { step2NotesEntities } from "@/mastra/workflows/notes-structure/steps/step2-entity-extraction";
import { step3NotesTimeline } from "@/mastra/workflows/notes-structure/steps/step3-relationship-mapping";
import { step4NotesFinalize } from "@/mastra/workflows/notes-structure/steps/step4-coding-timeline";
import { step5NotesAssembly } from "@/mastra/workflows/notes-structure/steps/step5-report-assembly";

export const notesStructureWorkflow = createWorkflow({
  id: "notes-structure-workflow",
  inputSchema: notesStructureWorkflowInputSchema,
  outputSchema: notesStructureWorkflowOutputSchema,
})
  .then(step1NotesClassification)
  .then(step2NotesEntities)
  .then(step3NotesTimeline)
  .then(step4NotesFinalize)
  .then(step5NotesAssembly)
  .commit();
