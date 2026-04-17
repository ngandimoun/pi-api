import { z } from "zod";

export const executionPlanRoutineRefSchema = z.object({
  routine_id: z.string().min(1),
  routine_file: z.string().min(1),
  execution_order: z.number().int().min(1),
  reason: z.string().min(1),
});

export const executionPlanGlueSchema = z.object({
  routine_id: z.string().min(1),
  description: z.string().min(1),
});

export const executionPlanSchema = z.object({
  plan_id: z.string().min(1),
  intent: z.string().min(1),
  routines: z.array(executionPlanRoutineRefSchema).min(1),
  glue_routine: executionPlanGlueSchema.optional(),
});

export type ExecutionPlan = z.infer<typeof executionPlanSchema>;
export type ExecutionPlanRoutineRef = z.infer<typeof executionPlanRoutineRefSchema>;

/**
 * Render an execution plan as markdown with YAML frontmatter for agents.
 */
export function renderExecutionPlan(plan: ExecutionPlan): string {
  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`pi_execution_plan: "1"`);
  lines.push(`plan_id: ${plan.plan_id}`);
  lines.push(`intent: "${plan.intent.replace(/"/g, '\\"')}"`);
  lines.push(`---`);
  lines.push("");
  lines.push(`# Pi Execution Plan: ${plan.plan_id}`);
  lines.push("");
  lines.push(`This intent spans multiple saved routines. Execute in order:`);
  lines.push("");
  for (const r of [...plan.routines].sort((a, b) => a.execution_order - b.execution_order)) {
    lines.push(`${r.execution_order}. **${r.routine_id}** — ${r.reason}`);
    lines.push(`   File: \`${r.routine_file}\``);
    lines.push("");
  }
  if (plan.glue_routine) {
    lines.push(`Then execute the integration routine:`);
    lines.push(`- **${plan.glue_routine.routine_id}** — ${plan.glue_routine.description}`);
    lines.push("");
  }
  lines.push(`## For the coding agent`);
  lines.push("");
  lines.push(
    `Read and execute each routine file in order. Each routine's \`files_manifest\` lists what it creates or touches.`
  );
  lines.push("");
  return lines.join("\n");
}
