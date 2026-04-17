import { createHmac, timingSafeEqual } from "node:crypto";

import { tasks } from "@trigger.dev/sdk/v3";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";

/**
 * GitHub webhook receiver for Pi CLI PR checks (optional HMAC verification).
 */
export async function POST(request: Request) {
  const requestId = `req_pi_${crypto.randomUUID()}`;
  const raw = await request.text();

  const secret = process.env.PI_CLI_GITHUB_WEBHOOK_SECRET?.trim();
  const sig = request.headers.get("x-hub-signature-256");
  if (secret && sig?.startsWith("sha256=")) {
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const got = sig.slice("sha256=".length);
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(got, "hex");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return apiError("invalid_signature", "Invalid webhook signature.", 401, requestId, "authentication_error");
      }
    } catch {
      return apiError("invalid_signature", "Invalid webhook signature.", 401, requestId, "authentication_error");
    }
  }

  let payload: { action?: string; repository?: { full_name?: string }; pull_request?: { number?: number } };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return apiError("invalid_json", "Body must be JSON.", 400, requestId, "invalid_request_error");
  }

  const event = request.headers.get("x-github-event");
  if (
    event === "pull_request" &&
    (payload.action === "opened" || payload.action === "synchronize") &&
    payload.repository?.full_name &&
    payload.pull_request?.number
  ) {
    try {
      await tasks.trigger("cli-github-pr-check", {
        organizationId: "github-webhook",
        repo: payload.repository.full_name,
        prNumber: payload.pull_request.number,
      });
    } catch (e) {
      console.warn("[pi-cli/github] trigger_failed", e);
    }
  }

  const res = apiSuccessEnvelope({
    data: { received: true },
    object: "pi_cli_github_webhook",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
}
