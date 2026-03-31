import type { MetabciEegResult } from "@/lib/health/metabci-client";
import { metabciClassifyEeg } from "@/lib/health/metabci-client";
import {
  geminiDecodeEeg,
  geminiInterpretIntent,
  geminiPredictText,
  type GeminiInterpretResult,
  type GeminiPredictResult,
} from "@/lib/neuro/gemini-neuro";

export async function decodeEeg(params: {
  requestId: string;
  paradigm: string;
  data: string;
  device?: string;
  channels?: number;
  sample_rate?: number;
  context?: Record<string, unknown>;
}): Promise<{ result: MetabciEegResult; routing_fallbacks: string[] }> {
  const routing_fallbacks: string[] = [];

  try {
    const result = await metabciClassifyEeg({
      requestId: params.requestId,
      input: { data: params.data, modality: params.paradigm },
    });
    return { result, routing_fallbacks };
  } catch (error) {
    routing_fallbacks.push(error instanceof Error ? error.message : "metabci_failed");
  }

  const result = await geminiDecodeEeg({
    requestId: params.requestId,
    paradigm: params.paradigm,
    data: params.data,
    device: params.device,
    channels: params.channels,
    sample_rate: params.sample_rate,
    context: params.context,
  });
  routing_fallbacks.push("used_gemini_decode_fallback");
  return { result, routing_fallbacks };
}

export async function interpretIntent(params: {
  requestId: string;
  paradigm: string;
  decode: MetabciEegResult;
  context?: Record<string, unknown>;
  locale?: string;
}): Promise<{ result: GeminiInterpretResult; routing_fallbacks: string[] }> {
  const result = await geminiInterpretIntent({
    requestId: params.requestId,
    paradigm: params.paradigm,
    decode: params.decode,
    context: params.context,
    locale: params.locale,
  });
  return { result, routing_fallbacks: ["gemini_intent"] };
}

export async function predictText(params: {
  requestId: string;
  decoded_intent: string;
  paradigm: string;
  context?: Record<string, unknown>;
  locale?: string;
}): Promise<{ result: GeminiPredictResult; routing_fallbacks: string[] }> {
  const result = await geminiPredictText({
    requestId: params.requestId,
    decoded_intent: params.decoded_intent,
    paradigm: params.paradigm,
    context: params.context,
    locale: params.locale,
  });
  return { result, routing_fallbacks: ["gemini_predict"] };
}
