import { z } from "zod";

import { apiError, apiSuccessEnvelope } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { downloadLatestPiGraph, downloadLatestPiSystemStyle } from "@/lib/pi-cli-r2";

const syncBodySchema = z
  .object({
    /** If true, include the latest dependency graph JSON (may be large). */
    include_graph: z.boolean().optional(),
  })
  .strict();

/**
 * pi sync — fetch latest team artifacts from Cloudflare R2 (private objects).
 *
 * Note: the CLI persists these locally under `.pi/` for offline governance.
 */
export const POST = withApiAuth(async (request) => {
  const requestId = request.requestId;

  let body: unknown = {};
  try {
    if (request.headers.get("content-length") && request.headers.get("content-length") !== "0") {
      body = await request.json();
    }
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400, requestId, "invalid_request_error");
  }

  const parsed = syncBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid body.",
      400,
      requestId,
      "invalid_request_error"
    );
  }

  if (!process.env.R2_BUCKET_NAME?.trim() && !process.env.R2_PI_GRAPHS_BUCKET?.trim()) {
    return apiError(
      "sync_unconfigured",
      "R2 is not configured (missing R2_BUCKET_NAME / R2_PI_GRAPHS_BUCKET).",
      503,
      requestId,
      "api_error"
    );
  }

  try {
    const org = request.organizationId;
    const system_style = await downloadLatestPiSystemStyle(org);
    const graph = parsed.data.include_graph ? await downloadLatestPiGraph(org) : null;

    if (!system_style && !graph) {
      return apiError(
        "sync_not_found",
        "No team artifacts found in R2 yet. Ask your tech lead to run `pi learn` (or enable R2 uploads).",
        404,
        requestId,
        "invalid_request_error"
      );
    }

    const res = apiSuccessEnvelope({
      data: {
        system_style,
        graph,
        hints: {
          system_style_file: ".pi/system-style.json",
          graph_file: ".pi/graph-latest.json",
        },
      },
      object: "pi_cli_sync",
      requestId,
      status: "completed",
      httpStatus: 200,
    });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed.";
    return apiError("sync_failed", message, 500, requestId, "api_error");
  }
});
