export function startTimer(): number {
  return Date.now();
}

export function finishDiagnostic(params: {
  step: string;
  started_at: number;
  status: "ok" | "failed";
  detail?: Record<string, unknown>;
}): { step: string; status: "ok" | "failed"; duration_ms: number; detail: Record<string, unknown> } {
  return {
    step: params.step,
    status: params.status,
    duration_ms: Math.max(0, Date.now() - params.started_at),
    detail: params.detail ?? {},
  };
}

