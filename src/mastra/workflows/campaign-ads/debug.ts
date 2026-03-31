import type { z } from "zod";

import type { campaignDiagnosticsStepSchema } from "./schemas";

export function startTimer(): number {
  return Date.now();
}

export function finishDiagnostic(params: {
  step: string;
  started_at: number;
  status: "ok" | "failed";
  detail?: Record<string, unknown>;
}): z.infer<typeof campaignDiagnosticsStepSchema> {
  return {
    step: params.step,
    status: params.status,
    duration_ms: Math.max(0, Date.now() - params.started_at),
    detail: params.detail ?? {},
  };
}
