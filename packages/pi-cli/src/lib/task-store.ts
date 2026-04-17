import Conf from "conf";
import crypto from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

import { fingerprintCwd } from "./session-store.js";

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
    const age = now - t.created_at;
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

export function updateTaskStatus(
  task_id: string,
  status: TaskStatus,
  opts?: { error?: string; metadata?: Record<string, unknown> }
): PiTask | undefined {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.task_id === task_id);
  if (idx < 0) return undefined;
  const now = Date.now();
  const cur = tasks[idx];
  const next: PiTask = {
    ...cur,
    status,
    error: opts?.error ?? cur.error,
    metadata: opts?.metadata ? { ...cur.metadata, ...opts.metadata } : cur.metadata,
    started_at: status === "running" ? (cur.started_at ?? now) : cur.started_at,
    completed_at:
      status === "completed" || status === "failed" || status === "skipped" ? now : cur.completed_at,
  };
  saveTaskRecord(next);
  return next;
}

export function getTaskById(task_id: string): PiTask | undefined {
  return loadTasks().find((t) => t.task_id === task_id);
}

export function findRootTaskId(task_id: string): string {
  let cur = getTaskById(task_id);
  const seen = new Set<string>();
  while (cur?.parent_task_id && !seen.has(cur.task_id)) {
    seen.add(cur.task_id);
    const p = getTaskById(cur.parent_task_id);
    if (!p) break;
    cur = p;
  }
  return cur?.task_id ?? task_id;
}

export function getTaskTree(root_task_id: string): PiTask[] {
  const all = loadTasks();
  const byParent = new Map<string | undefined, PiTask[]>();
  for (const t of all) {
    const p = t.parent_task_id;
    const arr = byParent.get(p) ?? [];
    arr.push(t);
    byParent.set(p, arr);
  }
  const out: PiTask[] = [];
  const walk = (id: string) => {
    const children = byParent.get(id) ?? [];
    for (const c of children.sort((a, b) => a.created_at - b.created_at)) {
      out.push(c);
      walk(c.task_id);
    }
  };
  const root = all.find((t) => t.task_id === root_task_id);
  if (root) {
    out.push(root);
    walk(root_task_id);
  }
  return out;
}

export function getTasksForSession(session_id: string): PiTask[] {
  return loadTasks()
    .filter((t) => t.session_id === session_id)
    .sort((a, b) => a.created_at - b.created_at);
}

export function getActiveTasksForRepo(cwd: string): PiTask[] {
  const fp = fingerprintCwd(cwd);
  return loadTasks().filter(
    (t) => t.context.cwd_fingerprint === fp && (t.status === "pending" || t.status === "running")
  );
}

export function getPausedTasks(cwd: string): PiTask[] {
  const fp = fingerprintCwd(cwd);
  return loadTasks().filter(
    (t) =>
      t.context.cwd_fingerprint === fp &&
      (t.status === "pending" || t.status === "running") &&
      t.metadata?.paused === true
  );
}

export function pruneCompletedTasksManual(): number {
  const conf = getTasksConf();
  const now = Date.now();
  const raw = conf.get("tasks") ?? [];
  const pruned = pruneTasks(raw, now);
  const n = raw.length - pruned.length;
  conf.set("tasks", pruned);
  return n;
}
