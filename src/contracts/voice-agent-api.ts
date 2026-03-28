import { z } from "zod";

import { isGeminiLiveVoiceName } from "@/lib/gemini/live/config";

const voiceMetadataSchema = z
  .record(z.string().trim().max(500))
  .refine((value) => Object.keys(value).length <= 32, {
    message: "metadata may contain at most 32 keys.",
  })
  .optional();

export const voiceAgentQuestionSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "key must start with a letter and use alphanumeric or underscore."),
    ask: z.string().trim().min(1).max(2000),
    type: z.enum(["enum", "text", "number", "boolean", "date"]),
    options: z.array(z.string().trim().min(1)).max(64).optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === "enum" && (!q.options || q.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "options is required when type is enum.",
        path: ["options"],
      });
    }
    if (q.type === "number") {
      if (q.min !== undefined && q.max !== undefined && q.min > q.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "min must be <= max.",
          path: ["min"],
        });
      }
    }
  });

export const voiceAgentBehaviorsSchema = z.object({
  greeting: z.string().trim().max(2000).optional(),
  tone: z.enum(["professional", "friendly", "neutral", "empathetic"]).optional(),
  max_duration_seconds: z.number().int().min(60).max(1800).optional(),
  allow_interruptions: z.boolean().optional(),
  end_conversation_after_questions: z.boolean().optional(),
  speaking_pace: z.enum(["slow", "normal", "fast"]).optional(),
  response_length: z.enum(["brief", "moderate", "detailed"]).optional(),
  escalation_phrase: z.string().trim().min(1).max(2000).optional(),
  follow_up_enabled: z.boolean().optional(),
  silence_timeout_seconds: z.number().int().min(5).max(60).optional(),
  closing_message: z.string().trim().min(1).max(4000).optional(),
  require_all_questions: z.boolean().optional(),
});

const MAX_OUTPUT_SCHEMA_STRICT_CHARS = 48_000;

export const voiceAgentOutputSchemaStrictSchema = z
  .custom<Record<string, unknown>>(
    (val) => typeof val === "object" && val !== null && !Array.isArray(val),
    { message: "output_schema_strict must be a JSON object (JSON Schema draft subset)." }
  )
  .refine((obj) => JSON.stringify(obj).length <= MAX_OUTPUT_SCHEMA_STRICT_CHARS, {
    message: `output_schema_strict must serialize to at most ${MAX_OUTPUT_SCHEMA_STRICT_CHARS} characters.`,
  });

export const voiceAgentVoiceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((n) => isGeminiLiveVoiceName(n), {
        message: "voice.name must be a supported Gemini Live prebuilt voice (see GET /api/v1/voice/voices).",
      })
      .optional(),
    language_code: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(
        /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,3}$/,
        "language_code must look like a BCP 47 tag (e.g. en-US, fr-FR)."
      )
      .optional(),
  })
  .strict();

/**
 * Values are type hints: "text", "number", "boolean", "date", or "enum:opt1,opt2".
 */
export const voiceAgentOutputSchemaField = z.record(
  z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  z.string().trim().min(1).max(200)
);

export const voiceAgentCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  language: z.string().trim().min(2).max(32).default("en-US"),
  purpose: z.string().trim().max(200).optional(),
  instructions: z.string().trim().min(1).max(16000),
  questions: z.array(voiceAgentQuestionSchema).max(64).default([]),
  behaviors: voiceAgentBehaviorsSchema.optional(),
  output_schema: voiceAgentOutputSchemaField
    .refine((o) => Object.keys(o).length <= 64, { message: "output_schema may contain at most 64 keys." })
    .default({}),
  /** Optional JSON Schema (subset supported by Gemini). When set, extraction uses constrained decoding + validation. */
  output_schema_strict: voiceAgentOutputSchemaStrictSchema.optional(),
  /** Override model id for post-session extraction (defaults to campaign orchestrator env). */
  extraction_model: z.string().trim().min(1).max(128).optional(),
  voice: voiceAgentVoiceSchema.optional(),
  metadata: voiceMetadataSchema,
});

export const voiceAgentUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  language: z.string().trim().min(2).max(32).optional(),
  purpose: z.string().trim().max(200).optional(),
  instructions: z.string().trim().min(1).max(16000).optional(),
  questions: z.array(voiceAgentQuestionSchema).max(64).optional(),
  behaviors: voiceAgentBehaviorsSchema.optional(),
  output_schema: voiceAgentOutputSchemaField
    .refine((o) => Object.keys(o).length <= 64, { message: "output_schema may contain at most 64 keys." })
    .optional(),
  output_schema_strict: voiceAgentOutputSchemaStrictSchema.nullable().optional(),
  extraction_model: z.string().trim().min(1).max(128).nullable().optional(),
  voice: voiceAgentVoiceSchema.optional(),
  metadata: voiceMetadataSchema,
  is_active: z.boolean().optional(),
});

export type VoiceAgentCreateInput = z.infer<typeof voiceAgentCreateInputSchema>;
export type VoiceAgentUpdateInput = z.infer<typeof voiceAgentUpdateInputSchema>;
