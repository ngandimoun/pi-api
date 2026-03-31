import { z } from "zod";

import { apiError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { subscribeToOrg } from "@/lib/surveillance/incident-store";

const querySchema = z.object({
  severity: z.enum(["info", "warning", "critical"]).optional(),
});

/**
 * Server-Sent Events stream of robotics-related incidents for an org (shared with surveillance incidents).
 * This provides a single, developer-friendly event channel for robot runs.
 */
export const GET = withApiAuth(async (request) => {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    severity: url.searchParams.get("severity") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("invalid_query", "Invalid query parameters.", 400, request.requestId);
  }

  const { severity } = parsed.data;
  const orgId = request.organizationId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      const unsubscribe = subscribeToOrg(orgId, (inc) => {
        if (severity && inc.severity !== severity) return;
        send(`event: incident\ndata: ${JSON.stringify(inc)}\n\n`);
      });

      const interval = setInterval(() => {
        send(`: heartbeat\n\n`);
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Request-Id": request.requestId,
    },
  });
});

