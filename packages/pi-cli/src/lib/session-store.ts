import Conf from "conf";
import crypto from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

import { scoreIntentMatch } from "./thread-matcher.js";

export type SessionStatus = "question" | "building" | "resolved" | "abandoned";

export type SessionChatMsg = { role: "user" | "assistant"; content: string };

export type PiCliSessionRecord = {
  session_id: string;
  cwd_fingerprint: string;
  branch_name: string;
  intent_summary: string;
  last_pi_message: string;
  last_updated: number;
  status: SessionStatus;
  /** Server-side Mastra thread id (org+dev+branch) — informational */
  thread_id: string;
  /** Rolling transcript for cross-invocation resume */
  messages: SessionChatMsg[];
  resonance_rel?: string;
  /** Task ids still in progress for this session */
  active_tasks?: string[];
  /** Completed task ids (recent) */
  completed_tasks?: string[];
  last_checkpoint?: {
    task_id: string;
    workflow_run_id?: string;
    step_id?: string;
  };
};

type SessionsFile = {
  sessions: PiCliSessionRecord[];
};

const ACTIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESOLVED_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 40;
const MAX_MSG_CHARS = 8000;

function truncateMessages(msgs: SessionChatMsg[]): SessionChatMsg[] {
  const sliced = msgs.slice(-MAX_MESSAGES);
  return sliced.map((m) => ({
    role: m.role,
    content: m.content.length > MAX_MSG_CHARS ? `${m.content.slice(0, MAX_MSG_CHARS)}…` : m.content,
  }));
}

export function fingerprintCwd(cwd: string): string {
  const norm = path.resolve(cwd);
  return crypto.createHash("sha256").update(norm).digest("hex").slice(0, 32);
}

function emptyStore(): SessionsFile {
  return { sessions: [] };
}

function getSessionsConf(): Conf<SessionsFile> {
  return new Conf<SessionsFile>({
    projectName: "pi-cli",
    cwd: path.join(homedir(), ".config", "pi"),
    configName: "sessions",
    defaults: emptyStore(),
  });
}

function pruneSessions(sessions: PiCliSessionRecord[], now: number): PiCliSessionRecord[] {
  return sessions.filter((s) => {
    const age = now - s.last_updated;
    if (s.status === "resolved" || s.status === "abandoned") {
      return age < RESOLVED_TTL_MS;
    }
    return age < ACTIVE_TTL_MS;
  });
}

export function loadSessions(): PiCliSessionRecord[] {
  const conf = getSessionsConf();
  const now = Date.now();
  const raw = conf.get("sessions") ?? [];
  const pruned = pruneSessions(raw, now);
  if (pruned.length !== raw.length) {
    conf.set("sessions", pruned);
  }
  return pruned;
}

export function saveSessionRecord(rec: PiCliSessionRecord): void {
  const conf = getSessionsConf();
  const now = Date.now();
  let sessions = pruneSessions(conf.get("sessions") ?? [], now);
  const idx = sessions.findIndex((s) => s.session_id === rec.session_id);
  const next: PiCliSessionRecord = {
    ...rec,
    messages: truncateMessages(rec.messages),
    last_updated: now,
  };
  if (idx >= 0) sessions[idx] = next;
  else sessions = [next, ...sessions].slice(0, 200);
  conf.set("sessions", sessions);
}

export function upsertActiveSession(params: {
  cwd: string;
  branch_name: string;
  session_id?: string;
  intent_summary: string;
  thread_id: string;
  last_pi_message: string;
  messages: SessionChatMsg[];
  status: SessionStatus;
  resonance_rel?: string;
  active_tasks?: string[];
  completed_tasks?: string[];
  last_checkpoint?: PiCliSessionRecord["last_checkpoint"];
}): PiCliSessionRecord {
  const cwd_fingerprint = fingerprintCwd(params.cwd);
  const sessions = loadSessions();
  const byId = params.session_id ? sessions.find((s) => s.session_id === params.session_id) : undefined;
  const existing =
    byId ??
    sessions.find(
      (s) =>
        s.cwd_fingerprint === cwd_fingerprint &&
        s.branch_name === params.branch_name &&
        s.status !== "resolved" &&
        s.status !== "abandoned"
    );

  const session_id = existing?.session_id ?? params.session_id ?? crypto.randomUUID();
  const rec: PiCliSessionRecord = {
    session_id,
    cwd_fingerprint,
    branch_name: params.branch_name,
    intent_summary: params.intent_summary,
    last_pi_message: params.last_pi_message,
    last_updated: Date.now(),
    status: params.status,
    thread_id: params.thread_id,
    messages: truncateMessages(params.messages),
    resonance_rel: params.resonance_rel ?? existing?.resonance_rel,
    active_tasks: params.active_tasks ?? existing?.active_tasks,
    completed_tasks: params.completed_tasks ?? existing?.completed_tasks,
    last_checkpoint: params.last_checkpoint ?? existing?.last_checkpoint,
  };
  saveSessionRecord(rec);
  return rec;
}

export function updateSessionTaskCheckpoint(
  session_id: string,
  checkpoint: NonNullable<PiCliSessionRecord["last_checkpoint"]>
): void {
  const conf = getSessionsConf();
  const now = Date.now();
  const sessions = pruneSessions(conf.get("sessions") ?? [], now).map((s) =>
    s.session_id === session_id ? { ...s, last_checkpoint: checkpoint, last_updated: now } : s
  );
  conf.set("sessions", sessions);
}

export function markSessionResolved(session_id: string): void {
  const conf = getSessionsConf();
  const now = Date.now();
  const sessions = pruneSessions(conf.get("sessions") ?? [], now).map((s) =>
    s.session_id === session_id ? { ...s, status: "resolved" as const, last_updated: now } : s
  );
  conf.set("sessions", sessions);
}

export function markSessionAbandoned(session_id: string): void {
  const conf = getSessionsConf();
  const now = Date.now();
  const sessions = pruneSessions(conf.get("sessions") ?? [], now).map((s) =>
    s.session_id === session_id ? { ...s, status: "abandoned" as const, last_updated: now } : s
  );
  conf.set("sessions", sessions);
}

export function getRecentSessionsForRepo(cwd: string, branch: string, limit: number): PiCliSessionRecord[] {
  const fp = fingerprintCwd(cwd);
  return loadSessions()
    .filter((s) => s.cwd_fingerprint === fp && s.branch_name === branch)
    .sort((a, b) => b.last_updated - a.last_updated)
    .slice(0, limit);
}

export function findMatchingSessions(
  cwd: string,
  branch: string,
  query: string,
  opts?: { minScore?: number; statuses?: SessionStatus[] }
): Array<{ session: PiCliSessionRecord; score: number }> {
  const fp = fingerprintCwd(cwd);
  const minScore = opts?.minScore ?? 0.35;
  const statuses = opts?.statuses ?? (["question", "building"] as SessionStatus[]);
  const sessions = loadSessions().filter((s) => s.cwd_fingerprint === fp && s.branch_name === branch && statuses.includes(s.status));

  return sessions
    .map((session) => ({
      session,
      score: scoreIntentMatch(query, session.intent_summary, session.last_pi_message),
    }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

export function formatSessionAge(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
