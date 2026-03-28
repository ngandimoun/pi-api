import { z } from "zod";

import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { voiceAgentUpdateInputSchema } from "@/contracts/voice-agent-api";
import { buildVoiceAgentSystemInstruction } from "@/lib/voice/build-system-prompt";
import { mergeVoiceAgentForRebuild } from "@/lib/voice/merge-agent-update";
import { getServiceSupabaseClient } from "@/lib/supabase";
import type { AppRouteContext } from "@/types/api";
import type { VoiceAgent } from "@/types/database";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function toUnixTimestamp(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(ms / 1000);
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

function serializeAgent(row: VoiceAgent) {
  return {
    agent_id: row.id,
    name: row.name,
    language: row.language,
    purpose: row.purpose,
    instructions: row.instructions,
    questions: row.questions,
    behaviors: row.behaviors,
    output_schema: row.output_schema,
    output_schema_strict: row.output_schema_strict ?? null,
    extraction_model: row.extraction_model ?? null,
    voice: row.voice_config,
    metadata: row.metadata,
    is_active: row.is_active,
    created_at: toUnixTimestamp(String(row.created_at)),
    updated_at: toUnixTimestamp(String(row.updated_at)),
  };
}

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

  return apiSuccess(serializeAgent(data as VoiceAgent), "voice_agent", request.requestId);
});

export const PATCH = withApiAuth(async (request, context: AppRouteContext) => {
  const resolved = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolved ?? {});
  if (!parsedParams.success) {
    return apiError("invalid_agent_id", "Agent id must be a valid UUID.", 400, request.requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = voiceAgentUpdateInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const { data: existing, error: loadError } = await supabase
    .from("voice_agents")
    .select("*")
    .eq("id", parsedParams.data.id)
    .eq("org_id", request.organizationId)
    .maybeSingle();

  if (loadError) {
    return apiError(
      "voice_agent_lookup_failed",
      "Failed to load voice agent.",
      500,
      request.requestId,
      "api_error"
    );
  }
  if (!existing) {
    return apiError("voice_agent_not_found", "Voice agent not found.", 404, request.requestId);
  }

  const row = existing as VoiceAgent;
  const merged = mergeVoiceAgentForRebuild(row, parsed.data);
  const system_instruction = buildVoiceAgentSystemInstruction(merged);

  const update: Record<string, unknown> = {
    system_instruction,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.language !== undefined) update.language = parsed.data.language;
  if (parsed.data.purpose !== undefined) update.purpose = parsed.data.purpose;
  if (parsed.data.instructions !== undefined) update.instructions = parsed.data.instructions;
  if (parsed.data.questions !== undefined) update.questions = parsed.data.questions;
  if (parsed.data.behaviors !== undefined) update.behaviors = parsed.data.behaviors;
  if (parsed.data.output_schema !== undefined) update.output_schema = parsed.data.output_schema;
  if (parsed.data.output_schema_strict !== undefined) {
    update.output_schema_strict = parsed.data.output_schema_strict;
  }
  if (parsed.data.extraction_model !== undefined) {
    update.extraction_model = parsed.data.extraction_model;
  }
  if (parsed.data.voice !== undefined) update.voice_config = parsed.data.voice;
  if (parsed.data.metadata !== undefined) update.metadata = parsed.data.metadata;
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;

  const { data: updated, error: updateError } = await supabase
    .from("voice_agents")
    .update(update)
    .eq("id", parsedParams.data.id)
    .eq("org_id", request.organizationId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return apiError("voice_agent_update_failed", "Failed to update voice agent.", 500, request.requestId, "api_error");
  }

  return apiSuccess(serializeAgent(updated as VoiceAgent), "voice_agent", request.requestId);
});

export const DELETE = withApiAuth(async (request, context: AppRouteContext) => {
  const resolved = await resolveRouteParams(context.params);
  const parsedParams = paramsSchema.safeParse(resolved ?? {});
  if (!parsedParams.success) {
    return apiError("invalid_agent_id", "Agent id must be a valid UUID.", 400, request.requestId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("voice_agents")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", parsedParams.data.id)
    .eq("org_id", request.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return apiError("voice_agent_delete_failed", "Failed to delete voice agent.", 500, request.requestId, "api_error");
  }
  if (!data) {
    return apiError("voice_agent_not_found", "Voice agent not found.", 404, request.requestId);
  }

  return apiSuccess({ agent_id: parsedParams.data.id, deleted: true }, "voice_agent", request.requestId);
});
