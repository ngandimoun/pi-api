import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { buildCliResourceId, buildCliThreadId } from "@/lib/pi-cli-thread";
import { createPiCliMemory, isCliMemoryEnabled } from "@/lib/pi-cli-memory";

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
      "invalid_request_error"
    );
  }

  if (!isCliMemoryEnabled()) {
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

  const mem = createPiCliMemory();
  if (!mem) {
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

  const label = parsed.data.feedback === "up" ? "useful" : "not_useful";
  const content = `[prompt-feedback:${label}] slug=${parsed.data.intent_slug} intent=${JSON.stringify(parsed.data.intent)}`;

  try {
    await mem.createThread({
      resourceId,
      threadId,
      title: "Pi prompt feedback",
      saveThread: true,
    });
  } catch {
    /* thread may already exist */
  }

  try {
    await mem.addMessage({
      threadId,
      resourceId,
      role: "user",
      type: "text",
      content,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to persist feedback.";
    return apiError("feedback_failed", message, 500, requestId, "api_error");
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
