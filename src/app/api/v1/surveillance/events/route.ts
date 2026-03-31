import { z } from "zod";

import { incidentSchema } from "@/contracts/surveillance-api";
import { apiError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { subscribeToStream } from "@/lib/surveillance/incident-store";
import { getServiceSupabaseClient } from "@/lib/supabase";

const querySchema = z.object({
  stream_id: z.string().trim().min(1).max(256),
  severity: z.enum(["info", "warning", "critical"]).optional(),
});

/**
 * Server-Sent Events stream of surveillance incidents for a stream.
 */
export const GET = withApiAuth(async (request) => {
  if (process.env.SURVEILLANCE_ENABLED?.trim() === "false") {
    return apiError(
      "surveillance_disabled",
      "Surveillance API is disabled.",
      403,
      request.requestId,
      "permission_error"
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    stream_id: url.searchParams.get("stream_id") ?? "",
    severity: url.searchParams.get("severity") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("invalid_query", "stream_id is required.", 400, request.requestId);
  }

  const orgId = request.organizationId;
  const { stream_id, severity } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      try {
        const supabase = getServiceSupabaseClient();
        let history = supabase
          .from("surveillance_incidents")
          .select("payload,created_at")
          .eq("org_id", orgId)
          .eq("stream_id", stream_id)
          .order("created_at", { ascending: false })
          .limit(50);

        const { data: rows } = await history;
        if (rows?.length) {
          for (const row of [...rows].reverse()) {
            const payload = row.payload as unknown;
            const inc = incidentSchema.safeParse(payload);
            if (!inc.success) continue;
            if (severity && inc.data.severity !== severity) continue;
            send(`event: incident\ndata: ${JSON.stringify(inc.data)}\n\n`);
          }
        }
      } catch {
        send(`event: error\ndata: ${JSON.stringify({ code: "history_unavailable" })}\n\n`);
      }

      const unsubscribe = subscribeToStream(orgId, stream_id, (inc) => {
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
