import { z } from "zod";

import { routineSpecificationSchema } from "./schema.js";

export const templateCategorySchema = z.enum([
  "auth",
  "storage",
  "ui",
  "api",
  "deployment",
  "testing",
  "ai",
  "agent",
  "workflow",
  "backend",
  "integration",
  "database",
  "realtime",
  "infrastructure",
]);

export const routineTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: templateCategorySchema,
  stack: z.array(z.string()),
  routine_spec: routineSpecificationSchema,
});

export type RoutineTemplate = z.infer<typeof routineTemplateSchema>;
export type TemplateCategory = z.infer<typeof templateCategorySchema>;
