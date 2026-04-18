/**
 * Server-bundled subset of Pi CLI task persistence (same on-disk format as `packages/pi-cli` task-store).
 * Kept in `src/lib` so Next/Turbopack can resolve imports without Pi CLI's `.js`-suffix ESM paths.
 */
import Conf from "conf";
import crypto from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type TaskPriority = "critical" | "high" | "normal" | "low";

export type PiTaskContext = {
  cwd_fingerprint: string;
  branch: string;
  files?: string[];
  workflow_run_id?: string;
};

export type PiTask = {
  task_id: string;
  session_id?: string;
  command: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  parent_task_id?: string;
  metadata: Record<string, unknown>;
  error?: string;
  context: PiTaskContext;
};

type TasksFile = {
  tasks: PiTask[];
};

const COMPLETED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TASKS = 500;

export function fingerprintCwd(cwd: string): string {
  const norm = path.resolve(cwd);
  return crypto.createHash("sha256").update(norm).digest("hex").slice(0, 32);
}

function emptyStore(): TasksFile {
  return { tasks: [] };
}

function getTasksConf(): Conf<TasksFile> {
  return new Conf<TasksFile>({
    projectName: "pi-cli",
    cwd: path.join(homedir(), ".config", "pi"),
    configName: "tasks",
    defaults: emptyStore(),
  });
}

function pruneTasks(tasks: PiTask[], now: number): PiTask[] {
  return tasks.filter((t) => {
    if (t.status === "completed" || t.status === "failed" || t.status === "skipped") {
      const doneAt = t.completed_at ?? t.created_at;
      return now - doneAt < COMPLETED_TTL_MS;
    }
    if (t.status === "running" || t.status === "pending") {
      const touch = t.started_at ?? t.created_at;
      return now - touch < ACTIVE_STALE_MS;
    }
    return true;
  });
}

export function loadTasks(): PiTask[] {
  const conf = getTasksConf();
  const now = Date.now();
  const raw = conf.get("tasks") ?? [];
  const pruned = pruneTasks(raw, now);
  if (pruned.length !== raw.length) {
    conf.set("tasks", pruned);
  }
  return pruned;
}

export function saveTaskRecord(rec: PiTask): void {
  const conf = getTasksConf();
  const now = Date.now();
  let tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.task_id === rec.task_id);
  const next = { ...rec, created_at: rec.created_at || now };
  if (idx >= 0) tasks[idx] = next;
  else tasks = [next, ...tasks].slice(0, MAX_TASKS);
  conf.set("tasks", tasks);
}

export type CreateTaskInput = {
  command: string;
  description: string;
  priority?: TaskPriority;
  session_id?: string;
  parent_task_id?: string;
  metadata?: Record<string, unknown>;
  context: Omit<PiTaskContext, "cwd_fingerprint"> & { cwd: string };
};

export function createTask(input: CreateTaskInput): PiTask {
  const cwd_fingerprint = fingerprintCwd(input.context.cwd);
  const task: PiTask = {
    task_id: crypto.randomUUID(),
    session_id: input.session_id,
    command: input.command,
    description: input.description,
    status: "pending",
    priority: input.priority ?? "normal",
    created_at: Date.now(),
    parent_task_id: input.parent_task_id,
    metadata: input.metadata ?? {},
    context: {
      cwd_fingerprint,
      branch: input.context.branch,
      files: input.context.files,
      workflow_run_id: input.context.workflow_run_id,
    },
  };
  saveTaskRecord(task);
  return task;
}

export function getTaskById(task_id: string): PiTask | undefined {
  return loadTasks().find((t) => t.task_id === task_id);
}
