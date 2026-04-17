import { describe, expect, it } from "vitest";

import { createTask, findRootTaskId, getTaskTree, loadTasks } from "./task-store.js";

describe("task-store", () => {
  it("createTask and findRootTaskId", () => {
    const root = createTask({
      command: "validate",
      description: "root",
      context: { cwd: process.cwd(), branch: "main" },
    });
    const child = createTask({
      command: "validate",
      description: "step",
      parent_task_id: root.task_id,
      context: { cwd: process.cwd(), branch: "main" },
    });
    expect(findRootTaskId(child.task_id)).toBe(root.task_id);
    const tree = getTaskTree(root.task_id);
    expect(tree.length).toBeGreaterThanOrEqual(2);
    expect(tree[0].task_id).toBe(root.task_id);
  });

  it("loadTasks returns array", () => {
    expect(Array.isArray(loadTasks())).toBe(true);
  });
});
