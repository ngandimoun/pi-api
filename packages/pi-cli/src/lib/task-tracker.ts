import { createTask, getTaskById, saveTaskRecord, updateTaskStatus } from "./task-store.js";

type Ctx = { cwd: string; branch: string; files?: string[] };

/**
 * Lightweight parent + step tasks for CLI commands (best-effort; failures still propagate).
 */
export class CommandTaskTracker {
  readonly rootTaskId: string;
  private readonly ctx: Ctx;
  private readonly command: string;
  private readonly stepMap = new Map<string, string>();
  private readonly sessionId?: string;

  constructor(command: string, description: string, ctx: Ctx, sessionId?: string) {
    this.command = command;
    this.ctx = ctx;
    this.sessionId = sessionId;
    const root = createTask({
      command,
      description,
      session_id: sessionId,
      context: { cwd: ctx.cwd, branch: ctx.branch, files: ctx.files },
    });
    this.rootTaskId = root.task_id;
  }

  startStep(slug: string, description: string): string {
    const t = createTask({
      command: this.command,
      description,
      session_id: this.sessionId,
      parent_task_id: this.rootTaskId,
      context: { cwd: this.ctx.cwd, branch: this.ctx.branch, files: this.ctx.files },
      metadata: { slug },
    });
    this.stepMap.set(slug, t.task_id);
    updateTaskStatus(t.task_id, "running");
    return t.task_id;
  }

  completeStep(slug: string): void {
    const id = this.stepMap.get(slug);
    if (id) updateTaskStatus(id, "completed");
  }

  skipStep(slug: string): void {
    const id = this.stepMap.get(slug);
    if (id) updateTaskStatus(id, "skipped");
  }

  failStep(slug: string, err: unknown): void {
    const id = this.stepMap.get(slug);
    if (id) updateTaskStatus(id, "failed", { error: err instanceof Error ? err.message : String(err) });
  }

  complete(): void {
    updateTaskStatus(this.rootTaskId, "completed");
  }

  fail(err: unknown): void {
    updateTaskStatus(this.rootTaskId, "failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  linkWorkflowRun(runId: string): void {
    const cur = getTaskById(this.rootTaskId);
    if (cur) {
      saveTaskRecord({
        ...cur,
        context: { ...cur.context, workflow_run_id: runId },
        metadata: { ...cur.metadata, workflow_run_id: runId },
      });
    }
  }
}
