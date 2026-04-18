import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import {
  isPromptFeedbackPersistenceEnabled,
  persistPromptFeedbackToMastraMemoryTables,
} from "@/lib/pi-cli-feedback-persist";
import { buildCliResourceId, buildCliThreadId } from "@/lib/pi-cli-thread";

const feedbackBodySchema = z
  .object({
    intent_slug: z.string().min(1).max(128),
    intent: z.string().min(1).max(4000),
    feedback: z.enum(["up", "down"]),
    thread_id: z.string().max(256).optional(),
    branch_name: z.string().max(256).optional(),
    developer_id: z.string().max(256).optional(),
  })
  .strict();

/**
 * Record thumbs-up/down on a compiled prompt so future memory recall can improve.
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = feedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid body.",
      400,
      requestId,
      "invalid_request_error",
    );
  }

  if (!isPromptFeedbackPersistenceEnabled()) {
    const res = apiSuccessEnvelope({
      data: { ok: true as const, persisted: false },
      object: "pi_cli_prompt_feedback",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  const resourceId = buildCliResourceId(request.organizationId);
  const threadId =
    parsed.data.thread_id?.trim() ||
    buildCliThreadId({
      organizationId: request.organizationId,
      branchName: parsed.data.branch_name ?? "default",
      developerId: parsed.data.developer_id,
    });

  const feedbackLabel = parsed.data.feedback === "up" ? "useful" : "not_useful";

  const result = await persistPromptFeedbackToMastraMemoryTables({
    resourceId,
    threadId,
    intentSlug: parsed.data.intent_slug,
    intent: parsed.data.intent,
    feedbackLabel,
  });

  if (!result.ok) {
    if (result.error === "database_not_configured" || result.error === "deferred_during_build") {
      const res = apiSuccessEnvelope({
        data: { ok: true as const, persisted: false },
        object: "pi_cli_prompt_feedback",
        requestId,
        status: "completed",
        httpStatus: 200,
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
    if (result.error === "canonical_parse_failed") {
      const res = apiSuccessEnvelope({
        data: { ok: true as const, persisted: false },
        object: "pi_cli_prompt_feedback",
        requestId,
        status: "completed",
        httpStatus: 200,
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
    return apiError("feedback_failed", result.error, 500, requestId, "api_error");
  }

  const res = apiSuccessEnvelope({
    data: { ok: true as const, persisted: true },
    object: "pi_cli_prompt_feedback",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
});
