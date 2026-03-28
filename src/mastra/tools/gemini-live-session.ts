import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { connectGeminiLiveSdk } from "@/lib/gemini/live/sdk";
import { getGeminiLiveModelId } from "@/lib/gemini/live/config";
import { combineLiveTools, makeLiveFunctionTools, makeLiveGoogleSearchTool } from "@/lib/gemini/live/tools";

const inputSchema = z.object({
  prompt: z.string().min(1),
  include_output_transcription: z.boolean().default(true),
  include_input_transcription: z.boolean().default(false),
  voice_name: z.string().min(1).optional(),
  thinking_level: z.enum(["minimal", "low", "medium", "high"]).default("minimal"),
  include_thoughts: z.boolean().default(false),
  tools: z
    .object({
      google_search: z.boolean().optional(),
      function_declarations: z
        .array(
          z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            parameters: z.record(z.unknown()).optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

const outputSchema = z.object({
  model_id: z.literal("gemini-3.1-flash-live-preview"),
  sent: z.object({
    prompt: z.string(),
  }),
  observed: z.object({
    tool_call_detected: z.boolean(),
    output_transcription_text: z.string().nullable(),
    input_transcription_text: z.string().nullable(),
    interrupted: z.boolean(),
    go_away: z.boolean(),
  }),
});

/**
 * Deterministic, bounded Live interaction tool.
 * Internal use for workflows/tests; not meant to stream audio end-to-end.
 */
export const geminiLiveSessionTool = createTool({
  id: "gemini-live-session",
  description:
    "Connects to Gemini Live (3.1 Flash Live Preview), sends a single text prompt, and returns observed transcription/tool-call signals (bounded, internal).",
  inputSchema,
  outputSchema,
  execute: async (input) => {
    const model_id = getGeminiLiveModelId();

    const tools = (() => {
      const enableSearch = input.tools?.google_search === true;
      const declarations = input.tools?.function_declarations ?? [];
      const functionTools = declarations.length > 0 ? makeLiveFunctionTools(declarations) : undefined;
      const searchTool = enableSearch ? makeLiveGoogleSearchTool() : undefined;
      const combined = combineLiveTools(functionTools, searchTool);
      return combined.length > 0 ? combined : undefined;
    })();

    let outputTranscriptionText: string | null = null;
    let inputTranscriptionText: string | null = null;
    let interrupted = false;
    let goAway = false;
    let toolCallDetected = false;

    const responseQueue: unknown[] = [];
    const session = await connectGeminiLiveSdk({
      session: {
        output_audio_transcription: input.include_output_transcription,
        input_audio_transcription: input.include_input_transcription,
        voice_name: input.voice_name,
        thinking_level: input.thinking_level,
        include_thoughts: input.include_thoughts,
      },
      tools,
      callbacks: {
        onmessage: (message) => {
          responseQueue.push(message);
        },
      },
    });

    // Seed prompt as client content (initial context). For 3.1, incremental updates should use realtimeInput.
    session.sendClientContent({ turns: input.prompt, turnComplete: true });

    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const msg = responseQueue.shift();
      if (!msg) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }

      const record = msg as Record<string, unknown>;
      if (record.toolCall) {
        toolCallDetected = true;
      }

      const serverContent = record.serverContent as Record<string, unknown> | undefined;
      if (serverContent) {
        if (serverContent.interrupted === true) interrupted = true;
        if (serverContent.outputTranscription) {
          const t = serverContent.outputTranscription as Record<string, unknown>;
          if (typeof t.text === "string") outputTranscriptionText = t.text;
        }
        if (serverContent.inputTranscription) {
          const t = serverContent.inputTranscription as Record<string, unknown>;
          if (typeof t.text === "string") inputTranscriptionText = t.text;
        }
        if (serverContent.turnComplete === true) {
          break;
        }
      }

      if (record.goAway) {
        goAway = true;
      }
    }

    session.close();

    return {
      model_id,
      sent: { prompt: input.prompt },
      observed: {
        tool_call_detected: toolCallDetected,
        output_transcription_text: outputTranscriptionText,
        input_transcription_text: inputTranscriptionText,
        interrupted,
        go_away: goAway,
      },
    };
  },
});

