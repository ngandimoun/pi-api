import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { buildVoiceAgentSystemInstruction } from "@/lib/voice/build-system-prompt";
import { mergeVoiceAgentForRebuild } from "@/lib/voice/merge-agent-update";
import { getServiceSupabaseClient } from "@/lib/supabase";
import type { AppRouteContext } from "@/types/api";
import type { VoiceAgent } from "@/types/database";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

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
 * Preview compiled system_instruction for an agent (no LiveKit / Gemini session).
 */
export const GET = withApiAuth(async (request, context: AppRouteContext) => {
  const resolved = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolved ?? {});
  if (!parsedParams.success) {
    return apiError("invalid_agent_id", "Agent id must be a valid UUID.", 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("voice_agents")
    .select("*")
    .eq("id", parsedParams.data.id)
    .eq("org_id", request.organizationId)
    .maybeSingle();

  if (error) {
    return apiError("lookup_failed", "Failed to fetch voice agent.", 500, request.requestId, "api_error");
  }
  if (!data) {
    return apiError("voice_agent_not_found", "Voice agent not found.", 404, request.requestId);
  }

  const row = data as VoiceAgent;
  const merged = mergeVoiceAgentForRebuild(row, {});
  const system_instruction = buildVoiceAgentSystemInstruction(merged);

  return apiSuccess(
    {
      agent_id: row.id,
      system_instruction,
    },
    "voice_agent_preview",
    request.requestId
  );
});
