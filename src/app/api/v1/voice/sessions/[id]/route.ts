import { z } from "zod";

import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { serializeVoiceSession } from "@/lib/voice/serialize-voice-session";
import { getServiceSupabaseClient } from "@/lib/supabase";
import type { AppRouteContext } from "@/types/api";
import type { VoiceSession } from "@/types/database";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const querySchema = z.object({
  wait_for_completion: z
    .string()
    .transform((value) => value === "true")
    .optional(),
  timeout_seconds: z.coerce.number().int().min(1).max(120).optional(),
});

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "expired";
}

async function resolveRouteParams(
  params: unknown
): Promise<Record<string, string | string[]> | undefined> {
  if (!params) {
    return undefined;
  }
  if (typeof (params as Promise<unknown>).then === "function") {
    const awaited = await (params as Promise<unknown>);
    if (awaited && typeof awaited === "object") {
      return awaited as Record<string, string | string[]>;
    }
    return undefined;
  }
  if (typeof params === "object") {
    return params as Record<string, string | string[]>;
  }
  return undefined;
}

/**
 * Retrieve a voice session (status, transcript, structured results when present).
 */
export const GET = withApiAuth(async (request, context: AppRouteContext) => {
  const resolved = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolved ?? {});
  if (!parsedParams.success) {
    return apiError("invalid_session_id", "Session id must be a valid UUID.", 400, request.requestId);
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    wait_for_completion: url.searchParams.get("wait_for_completion") ?? undefined,
    timeout_seconds: url.searchParams.get("timeout_seconds") ?? undefined,
  });
  if (!parsedQuery.success) {
    return apiZodError("invalid_query", parsedQuery.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const waitForCompletion = parsedQuery.data.wait_for_completion === true;
  const timeoutSeconds = parsedQuery.data.timeout_seconds ?? 30;
  const deadlineMs = Date.now() + timeoutSeconds * 1000;

  let row: VoiceSession | null = null;

  while (Date.now() <= deadlineMs) {
    const { data, error } = await supabase
      .from("voice_sessions")
      .select("*")
      .eq("id", parsedParams.data.id)
      .eq("org_id", request.organizationId)
      .maybeSingle();

    if (error) {
      return apiError("lookup_failed", "Failed to fetch voice session.", 500, request.requestId, "api_error");
    }
    if (!data) {
      return apiError("voice_session_not_found", "Voice session not found.", 404, request.requestId);
    }

    row = data as VoiceSession;
    if (!waitForCompletion || isTerminalStatus(row.status)) {
      break;
    }
    await sleep(1000);
  }

  if (!row) {
    return apiError("voice_session_not_found", "Voice session not found.", 404, request.requestId);
  }

  console.info("[voice.sessions.get] ok", {
    requestId: request.requestId,
    sessionId: row.id,
    status: row.status,
  });

  return apiSuccess(serializeVoiceSession(row), "voice_session", request.requestId);
});
