import { z } from "zod";

import { voiceAgentVoiceSchema } from "@/contracts/voice-agent-api";

const MAX_CONTEXT_JSON_CHARS = 16_000;

export const voiceSessionParticipantSchema = z.object({
  identity: z.string().trim().min(1).max(256),
  name: z.string().trim().max(256).optional(),
});

const voiceSessionContextSchema = z
  .record(z.unknown())
  .refine((ctx) => JSON.stringify(ctx).length <= MAX_CONTEXT_JSON_CHARS, {
    message: `context must serialize to at most ${MAX_CONTEXT_JSON_CHARS} characters.`,
  });

export const voiceSessionCreateInputSchema = z
  .object({
    agent_id: z.string().uuid(),
    participant: voiceSessionParticipantSchema,
    context: voiceSessionContextSchema.optional(),
    /** LiveKit empty timeout, JWT and Gemini ephemeral expiry window (default 600). Must be >= max_duration_seconds when both are set. */
    ttl_seconds: z.number().int().min(60).max(3600).optional().default(600),
    /** Per-session override for max call length (seconds). Falls back to agent behaviors.max_duration_seconds when omitted. */
    max_duration_seconds: z.number().int().min(60).max(1800).optional(),
    /** Optional override of agent voice / speech language for this session only. */
    voice: voiceAgentVoiceSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.max_duration_seconds !== undefined &&
      data.ttl_seconds !== undefined &&
      data.ttl_seconds < data.max_duration_seconds
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ttl_seconds must be greater than or equal to max_duration_seconds when both are provided.",
        path: ["ttl_seconds"],
      });
    }
  });

export const voiceSessionTranscriptEntrySchema = z.object({
  role: z.enum(["agent", "user"]),
  text: z.string().min(1).max(32000),
  timestamp: z.number().int().nonnegative().optional(),
});

export const voiceSessionCompleteInputSchema = z.object({
  transcript: z.array(voiceSessionTranscriptEntrySchema).min(1).max(5000),
  duration_seconds: z.number().int().min(0).max(86400).optional(),
});

export type VoiceSessionCreateInput = z.infer<typeof voiceSessionCreateInputSchema>;
export type VoiceSessionCompleteInput = z.infer<typeof voiceSessionCompleteInputSchema>;

/** Response `data` for POST /api/v1/voice/sessions (envelope uses apiSuccessEnvelope, status `active`). */
export const voiceSessionStartResponseDataSchema = z.object({
  session_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  connection: z.object({
    livekit: z.object({
      url: z.string().min(1),
      token: z.string().min(1),
    }),
    gemini_live: z.object({
      url: z.string().min(1),
      token: z.string().min(1),
    }),
  }),
  system_instruction: z.string(),
  expires_at: z.number().int(),
  /** When set, client should end the voice call and disconnect by (session_start + this many seconds). */
  max_duration_seconds: z.number().int().min(60).max(1800).nullable(),
});

export type VoiceSessionStartResponseData = z.infer<typeof voiceSessionStartResponseDataSchema>;
