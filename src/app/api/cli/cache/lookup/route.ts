import { createHash } from "node:crypto";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";

/**
 * L3 cache lookup placeholder — key hash → hit/miss (wire R2 / DB later).
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const key = typeof (body as { key?: unknown })?.key === "string" ? (body as { key: string }).key : "";
  if (!key) {
    return apiError("invalid_body", "Missing key string.", 400, requestId, "invalid_request_error");
  }

  const hash = createHash("sha256").update(key).digest("hex");

  const res = apiSuccessEnvelope({
    data: {
      hit: false,
      key_hash: hash,
      note: "L3 cache backend not configured; always miss.",
    },
    object: "pi_cli_cache_lookup",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
});
