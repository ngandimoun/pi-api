import type { VoiceAgent } from "@/types/database";
import type { VoiceAgentCreateInput, VoiceAgentUpdateInput } from "@/contracts/voice-agent-api";

function coerceStrictSchema(row: VoiceAgent): VoiceAgentCreateInput["output_schema_strict"] {
  const raw = row.output_schema_strict;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return undefined;
}

function coerceExtractionModel(row: VoiceAgent): VoiceAgentCreateInput["extraction_model"] {
  return typeof row.extraction_model === "string" && row.extraction_model.trim()
    ? row.extraction_model.trim()
    : undefined;
}

/**
 * Applies a partial update onto an existing agent row and returns a full create-shaped object for prompt rebuild.
 */
export function mergeVoiceAgentForRebuild(
  row: VoiceAgent,
  patch: VoiceAgentUpdateInput
): VoiceAgentCreateInput {
  const questionsRaw = patch.questions ?? row.questions;
  const questions = (Array.isArray(questionsRaw) ? questionsRaw : []) as VoiceAgentCreateInput["questions"];

  const behaviors = (patch.behaviors ?? row.behaviors ?? {}) as NonNullable<VoiceAgentCreateInput["behaviors"]>;

  const outputRaw = patch.output_schema ?? row.output_schema;
  const output_schema = (
    outputRaw && typeof outputRaw === "object" && !Array.isArray(outputRaw) ? outputRaw : {}
  ) as VoiceAgentCreateInput["output_schema"];

  const voiceRaw = patch.voice ?? row.voice_config;
  const voice =
    voiceRaw && typeof voiceRaw === "object" && !Array.isArray(voiceRaw)
      ? (voiceRaw as VoiceAgentCreateInput["voice"])
      : undefined;

  const metadata =
    patch.metadata ??
    (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, string>)
      : undefined);

  let output_schema_strict: VoiceAgentCreateInput["output_schema_strict"];
  if (patch.output_schema_strict !== undefined) {
    output_schema_strict =
      patch.output_schema_strict === null
        ? undefined
        : (patch.output_schema_strict as VoiceAgentCreateInput["output_schema_strict"]);
  } else {
    output_schema_strict = coerceStrictSchema(row);
  }

  let extraction_model: VoiceAgentCreateInput["extraction_model"];
  if (patch.extraction_model !== undefined) {
    extraction_model =
      patch.extraction_model === null ? undefined : (patch.extraction_model as string | undefined);
  } else {
    extraction_model = coerceExtractionModel(row);
  }

  return {
    name: patch.name ?? row.name,
    language: patch.language ?? row.language,
    purpose: patch.purpose !== undefined ? patch.purpose : row.purpose ?? undefined,
    instructions: patch.instructions ?? row.instructions,
    questions,
    behaviors,
    output_schema,
    output_schema_strict,
    extraction_model,
    voice,
    metadata,
  };
}
