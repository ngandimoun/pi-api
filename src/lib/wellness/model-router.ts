import { huatuoInterpretImage } from "@/lib/health/huatuogpt-client";
import { medgemmaWellnessSynthesis } from "@/lib/health/medgemma-client";
import { decodeEeg } from "@/lib/neuro/model-router";
import {
  geminiWellnessSynthesis,
  type WellnessSynthesisGemini,
} from "@/lib/wellness/gemini-wellness";

export async function runEegDecode(params: {
  requestId: string;
  paradigm: string;
  data: string;
  device?: string;
  channels?: number;
  sample_rate?: number;
  context?: Record<string, unknown>;
}) {
  return decodeEeg({
    requestId: params.requestId,
    paradigm: params.paradigm,
    data: params.data,
    device: params.device,
    channels: params.channels,
    sample_rate: params.sample_rate,
    context: params.context,
  });
}

function huatuoToNarrative(result: {
  narrative: string;
  findings: Array<{ title: string; summary: string }>;
}): string {
  const parts = [result.narrative.trim()];
  for (const f of result.findings ?? []) {
    if (f.title && f.summary) parts.push(`${f.title}: ${f.summary}`);
  }
  return parts.filter(Boolean).join(" | ").slice(0, 8000);
}

export async function synthesizeWellness(params: {
  requestId: string;
  locale?: string;
  image_data?: string;
  cognitive_state: Record<string, unknown>;
  eeg_decode: Record<string, unknown>;
  context?: Record<string, unknown>;
}): Promise<{
  synthesis: WellnessSynthesisGemini & { used_provider: "medgemma" | "gemini" };
  huatuo_narrative?: string;
  routing_fallbacks: string[];
}> {
  const routing_fallbacks: string[] = [];
  let huatuo_narrative: string | undefined;

  if (params.image_data?.trim()) {
    try {
      const huatuo = await huatuoInterpretImage({
        requestId: params.requestId,
        locale: params.locale,
        modality: "wellness_screenshot",
        imageUrlOrData: params.image_data.trim(),
        context: params.context,
      });
      huatuo_narrative = huatuoToNarrative(huatuo);
    } catch (e) {
      routing_fallbacks.push(e instanceof Error ? e.message : "huatuo_failed");
    }
  }

  try {
    const med = await medgemmaWellnessSynthesis({
      requestId: params.requestId,
      locale: params.locale,
      cognitive_state: params.cognitive_state,
      eeg_decode: params.eeg_decode,
      huatuo_narrative: huatuo_narrative,
      context: params.context,
    });
    const { used: _medUsed, ...medFields } = med;
    return {
      synthesis: {
        ...medFields,
        used_provider: "medgemma" as const,
      },
      huatuo_narrative,
      routing_fallbacks,
    };
  } catch (error) {
    routing_fallbacks.push(error instanceof Error ? error.message : "medgemma_failed");
  }

  const gem = await geminiWellnessSynthesis({
    requestId: params.requestId,
    locale: params.locale,
    cognitive_state: params.cognitive_state,
    eeg_decode: params.eeg_decode,
    huatuo_narrative: huatuo_narrative,
    context: params.context,
  });
  routing_fallbacks.push("used_gemini_wellness_synthesis_fallback");
  return {
    synthesis: { ...gem, used_provider: "gemini" },
    huatuo_narrative,
    routing_fallbacks,
  };
}
