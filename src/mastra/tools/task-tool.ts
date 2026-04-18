import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { createTask, getTaskById, loadTasks, saveTaskRecord } from "@/lib/pi-cli-task-store-server";

/**
 * Pi task management tool - allows agents to create, complete, and list tasks.
 * Backed by the same task-store as the Pi CLI (`pi tasks`).
 */

const taskStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped"]);
const taskPrioritySchema = z.enum(["critical", "high", "normal", "low"]);

export const piTaskTool = createTool({
  id: "pi-task",
  description:
    "Create, complete, or list Pi CLI tasks. Use 'create' to track work items, 'complete' to mark done, 'list' to see active tasks.",
  inputSchema: z.object({
    action: z.enum(["create", "complete", "list"]),
    task_id: z.string().optional(),
    command: z.string().optional(),
    description: z.string().max(500).optional(),
    priority: taskPrioritySchema.optional(),
    session_id: z.string().optional(),
    parent_task_id: z.string().optional(),
    cwd: z.string().optional(),
    branch: z.string().optional(),
    status: taskStatusSchema.optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    task_id: z.string().optional(),
    tasks: z
      .array(
        z.object({
          task_id: z.string(),
          command: z.string(),
          description: z.string(),
          status: taskStatusSchema,
          priority: taskPrioritySchema,
        })
      )
      .optional(),
  }),
  execute: async ({ action, task_id, command, description, priority, session_id, parent_task_id, cwd, branch, status }) => {
    try {
      if (action === "create") {
        if (!command || !description || !cwd || !branch) {
          return {
            success: false,
            message: "create requires: command, description, cwd, branch",
          };
        }

        const task = createTask({
          command,
          description,
          priority: priority ?? "normal",
          session_id,
          parent_task_id,
          context: { cwd, branch },
        });

        return {
          success: true,
          message: `Task created: ${task.task_id}`,
          task_id: task.task_id,
        };
      }

      if (action === "complete") {
        if (!task_id) {
          return { success: false, message: "complete requires task_id" };
        }

        const task = getTaskById(task_id);
        if (!task) {
          return { success: false, message: `Task not found: ${task_id}` };
        }

        saveTaskRecord({
          ...task,
          status: status ?? "completed",
          completed_at: Date.now(),
        });

        return {
          success: true,
          message: `Task marked ${status ?? "completed"}: ${task_id}`,
          task_id,
        };
      }

      if (action === "list") {
        const all = loadTasks();
        const active = all.filter((t) => t.status === "running" || t.status === "pending");

        return {
          success: true,
          message: `Found ${active.length} active tasks`,
          tasks: active.slice(0, 20).map((t) => ({
            task_id: t.task_id,
            command: t.command,
            description: t.description,
            status: t.status,
            priority: t.priority,
          })),
        };
      }

      return {
        success: false,
        message: `Unknown action: ${action}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Task tool error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
