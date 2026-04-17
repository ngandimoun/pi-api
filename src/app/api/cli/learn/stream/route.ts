import { apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";

/**
 * Reserved for multi-part server-side merges (Redis). The CLI merges chunked metadata
 * locally then POSTs once to `/api/cli/learn`.
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;
  await request.json().catch(() => ({}));
  const res = apiSuccessEnvelope({
    data: {
      note:
        "Chunked learn scan runs in the CLI (`pi learn --streaming`); use a single POST to /api/cli/learn with merged metadata.",
    },
    object: "pi_cli_learn_stream",
    requestId,
    status: "completed",
    httpStatus: 200,
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
});
