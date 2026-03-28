import { z } from "zod";

import { apiError, apiSuccess, apiZodError } from "@/lib/api-response";
import { withApiAuth } from "@/lib/auth";
import { voiceAgentCreateInputSchema } from "@/contracts/voice-agent-api";
import { buildVoiceAgentSystemInstruction } from "@/lib/voice/build-system-prompt";
import { getServiceSupabaseClient } from "@/lib/supabase";
import type { VoiceAgent } from "@/types/database";

function toUnixTimestamp(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(ms / 1000);
}

/**
 * Create a reusable voice agent configuration (OpenAI-style envelope).
 */
export const POST = withApiAuth(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_json_body", "Request body must be valid JSON.", 400, request.requestId);
  }

  const parsed = voiceAgentCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiZodError("invalid_request_body", parsed.error, 400, request.requestId);
  }

  const system_instruction = buildVoiceAgentSystemInstruction(parsed.data);
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("voice_agents")
    .insert({
      org_id: request.organizationId,
      name: parsed.data.name,
      language: parsed.data.language,
      purpose: parsed.data.purpose ?? null,
      instructions: parsed.data.instructions,
      questions: parsed.data.questions,
      behaviors: (parsed.data.behaviors ?? {}) as Record<string, unknown>,
      output_schema: parsed.data.output_schema,
      output_schema_strict: (parsed.data.output_schema_strict ?? null) as Record<string, unknown> | null,
      extraction_model: parsed.data.extraction_model ?? null,
      voice_config: (parsed.data.voice ?? {}) as Record<string, unknown>,
      system_instruction,
      metadata: (parsed.data.metadata ?? {}) as Record<string, unknown>,
    })
    .select("id,name,created_at")
    .single();

  if (error || !data) {
    return apiError("voice_agent_create_failed", "Failed to create voice agent.", 500, request.requestId, "api_error");
  }

  const row = data as Pick<VoiceAgent, "id" | "name" | "created_at">;

  console.info("[voice.agents.create] ok", {
    requestId: request.requestId,
    orgId: request.organizationId,
    agentId: row.id,
  });

  return apiSuccess(
    {
      agent_id: row.id,
      name: row.name,
      created_at: toUnixTimestamp(String(row.created_at)),
    },
    "voice_agent",
    request.requestId
  );
});

const voiceAgentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
});

/**
 * List voice agents for the authenticated organization.
 */
export const GET = withApiAuth(async (request) => {
  const url = new URL(request.url);
  const parsedQuery = voiceAgentListQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsedQuery.success) {
    return apiZodError("invalid_query", parsedQuery.error, 400, request.requestId);
  }
  const { limit, offset } = parsedQuery.data;

  const supabase = getServiceSupabaseClient();
  const { data: rows, error, count } = await supabase
    .from("voice_agents")
    .select(
      "id,name,language,purpose,is_active,created_at,updated_at",
      { count: "exact" }
    )
    .eq("org_id", request.organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError("list_failed", "Failed to list voice agents.", 500, request.requestId, "api_error");
  }

  const total = count ?? 0;
  const data = (rows ?? []).map((r) => {
    const row = r as VoiceAgent;
    return {
      agent_id: row.id,
      name: row.name,
      language: row.language,
      purpose: row.purpose,
      is_active: row.is_active,
      created_at: toUnixTimestamp(String(row.created_at)),
      updated_at: toUnixTimestamp(String(row.updated_at)),
    };
  });

  return apiSuccess(
    {
      object: "list",
      data,
      has_more: offset + data.length < total,
      total_count: total,
    },
    "voice_agent_list",
    request.requestId
  );
});
