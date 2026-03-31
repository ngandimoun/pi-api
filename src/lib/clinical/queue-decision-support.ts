import crypto from "crypto";

import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

import {
  decisionSupportInputSchema,
  type DecisionSupportInput,
} from "@/contracts/decision-support-api";
import { apiError, apiZodError } from "@/lib/api-response";
import { getServiceSupabaseClient } from "@/lib/supabase";
import type { AuthenticatedRequest } from "@/types/api";

function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => stableStringify(x)).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

function sha(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function queueDecisionSupport(request: AuthenticatedRequest): Promise<Response> {
  if (process.env.CLINICAL_DECISION_ENABLED?.trim() === "false") {
    return apiError(
      "decision_support_disabled",
      "Clinical decision support API is disabled.",
      403,
      request.requestId,
      "permission_error"
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Invalid JSON.", 400, request.requestId);
  }

  const parsed = decisionSupportInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const idem = request.headers.get("idempotency-key")?.trim() ?? "";
  const scope = "health_decision_support";
  const hash = sha(stableStringify(parsed.data));
  const keyHash = idem ? sha(idem) : null;

  if (keyHash) {
    const { data: ex, error } = await supabase
      .from("idempotency_requests")
      .select("request_hash,response_status,response_body")
      .eq("org_id", request.organizationId)
      .eq("scope", scope)
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (!error && ex) {
      if (ex.request_hash !== hash) {
        return apiError(
          "idempotency_key_mismatch",
          "Idempotency mismatch.",
          409,
          request.requestId,
          "invalid_request_error",
          { param: "Idempotency-Key" }
        );
      }
      const replay = NextResponse.json(ex.response_body, {
        status: Number(ex.response_status) || 200,
      });
      replay.headers.set("X-Idempotency-Replayed", "true");
      return replay;
    }
  }

  const { data: job, error: insErr } = await supabase
    .from("jobs")
    .insert({
      org_id: request.organizationId,
      type: "clinical_decision_support",
      status: "queued",
      payload: { phase: "queued", input: { has_guidelines: Boolean(parsed.data.input.guidelines) } },
    })
    .select("id")
    .single();

  if (insErr || !job) {
    return apiError("job_create_failed", "Job create failed.", 500, request.requestId, "api_error");
  }

  const p: { jobId: string; organizationId: string; input: DecisionSupportInput } = {
    jobId: job.id,
    organizationId: request.organizationId,
    input: parsed.data,
  };

  try {
    await tasks.trigger("decision-support-analyzer", p);
  } catch (e) {
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_log: e instanceof Error ? e.stack ?? e.message : "trigger_failed",
        payload: { phase: "failed" },
      })
      .eq("id", job.id);
    return apiError("job_trigger_failed", "Trigger failed.", 502, request.requestId, "api_error");
  }

  const rb = {
    id: request.requestId,
    object: "job",
    status: "queued",
    created_at: Math.floor(Date.now() / 1000),
    data: { job_id: job.id },
  };

  if (keyHash) {
    await supabase.from("idempotency_requests").insert({
      org_id: request.organizationId,
      scope,
      key_hash: keyHash,
      request_hash: hash,
      response_status: 202,
      response_body: rb,
    });
  }

  return NextResponse.json(rb, { status: 202 });
}
