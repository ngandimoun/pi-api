import { extractStructuredVoiceResults } from "@/lib/voice/extract-session-results";
import { getServiceSupabaseClient } from "@/lib/supabase";
import type { Json, VoiceAgent, VoiceSession } from "@/types/database";
import type { VoiceSessionCompleteInput } from "@/contracts/voice-session-api";

const EXTRACTION_WARNINGS_META_KEY = "pi_extraction_warnings";

export async function completeVoiceSession(input: {
  organizationId: string;
  sessionId: string;
  body: VoiceSessionCompleteInput;
}): Promise<{ session: VoiceSession; results: Json | null; extraction_warnings: string[] }> {
  const supabase = getServiceSupabaseClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("voice_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .eq("org_id", input.organizationId)
    .maybeSingle();

  if (sessionError) {
    console.warn("[voice.sessions.complete] session_lookup_failed", {
      sessionId: input.sessionId,
      message: sessionError.message,
    });
    throw new Error("voice_session_lookup_failed");
  }
  if (!sessionRow) {
    throw new Error("voice_session_not_found");
  }

  const session = sessionRow as VoiceSession;
  if (session.status !== "active") {
    throw new Error("voice_session_not_active");
  }

  const { data: agentRow, error: agentError } = await supabase
    .from("voice_agents")
    .select("*")
    .eq("id", session.agent_id)
    .eq("org_id", input.organizationId)
    .maybeSingle();

  if (agentError) {
    console.warn("[voice.sessions.complete] agent_lookup_failed", {
      agentId: session.agent_id,
      message: agentError.message,
    });
    throw new Error("voice_agent_lookup_failed");
  }
  if (!agentRow) {
    throw new Error("voice_agent_not_found");
  }

  const agent = agentRow as VoiceAgent;
  const outputSchema = (agent.output_schema ?? {}) as Record<string, string>;
  const strictRaw = agent.output_schema_strict;
  const outputSchemaStrict =
    strictRaw && typeof strictRaw === "object" && !Array.isArray(strictRaw)
      ? (strictRaw as Record<string, unknown>)
      : null;
  const extractionModel =
    typeof agent.extraction_model === "string" && agent.extraction_model.trim()
      ? agent.extraction_model.trim()
      : null;

  const shouldExtract = Object.keys(outputSchema).length > 0 || outputSchemaStrict !== null;

  let results: Json | null = null;
  let extraction_warnings: string[] = [];

  try {
    if (shouldExtract) {
      const outcome = await extractStructuredVoiceResults({
        transcript: input.body.transcript,
        outputSchema,
        outputSchemaStrict,
        extractionModel,
      });
      results = outcome.results;
      extraction_warnings = outcome.extraction_warnings;
    } else {
      results = { transcript_summary: input.body.transcript.map((t) => t.text).join(" | ") } as Json;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "extraction_failed";
    const { error: failUpdateError } = await supabase
      .from("voice_sessions")
      .update({
        status: "failed",
        error_log: message,
        transcript: input.body.transcript as unknown as Json,
        duration_seconds: input.body.duration_seconds ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.sessionId)
      .eq("org_id", input.organizationId);

    if (failUpdateError) {
      console.warn("[voice.sessions.complete] mark_failed_update_failed", {
        sessionId: input.sessionId,
        message: failUpdateError.message,
      });
    }

    throw new Error("voice_result_extraction_failed");
  }

  const prevMeta =
    session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
      ? ({ ...session.metadata } as Record<string, unknown>)
      : {};
  if (extraction_warnings.length > 0) {
    prevMeta[EXTRACTION_WARNINGS_META_KEY] = extraction_warnings;
  } else {
    delete prevMeta[EXTRACTION_WARNINGS_META_KEY];
  }

  const { data: updated, error: updateError } = await supabase
    .from("voice_sessions")
    .update({
      status: "completed",
      transcript: input.body.transcript as unknown as Json,
      results,
      duration_seconds: input.body.duration_seconds ?? null,
      error_log: null,
      metadata: prevMeta as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId)
    .eq("org_id", input.organizationId)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error("voice_session_update_failed");
  }

  console.info("[voice.sessions.complete] ok", { sessionId: input.sessionId, orgId: input.organizationId });

  return { session: updated as VoiceSession, results, extraction_warnings };
}
